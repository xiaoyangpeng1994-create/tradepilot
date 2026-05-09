import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PRICING,
  isItemCode,
  PTS_PER_YUAN,
  CUSTOM_RECHARGE_MIN_YUAN,
  CUSTOM_RECHARGE_MAX_YUAN,
  isUltraLevel,
  INVITER_FIRST_PAY_BONUS_PTS,
} from "@/lib/pricing";
import { settleCommission } from "@/lib/commission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEBOUNCE_MS = 3000;

type ResolvedItem = {
  kind: "SUBSCRIBE" | "RECHARGE";
  itemCode: string;
  amountCny: number;
  pts?: number;        // 充值获得的算力点（RECHARGE 用）
  giftPts?: number;    // VIP 开通时赠送的算力点（SUBSCRIBE 用）
  vipDays?: number;
  vipTier?: "TP_MAX" | "TP_ULTRA"; // 用于判断档位
};

// 开发模式下单 + 立即模拟支付。
// 真实支付链路上线后：拆成 /api/order/create 创建 PENDING + 支付网关 webhook 标记 PAID 并触发 settle。
export async function POST(req: NextRequest) {
  // Beta 模式：内测期间拒绝所有购买请求，防止模拟支付被滥用
  if (process.env.NEXT_PUBLIC_BETA_MODE === "true") {
    return NextResponse.json(
      { error: "内测期间暂未开放付费，请等待正式上线通知" },
      { status: 403 },
    );
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { itemCode?: string; customAmountYuan?: number }
    | null;
  const code = body?.itemCode;

  // 解析商品：固定档位 or 自定义充值
  let item: ResolvedItem;
  if (code === "PTS_CUSTOM") {
    const yuan = Number(body?.customAmountYuan);
    if (
      !Number.isFinite(yuan) ||
      !Number.isInteger(yuan) ||
      yuan < CUSTOM_RECHARGE_MIN_YUAN ||
      yuan > CUSTOM_RECHARGE_MAX_YUAN
    ) {
      return NextResponse.json(
        {
          error: `自定义金额必须为 ¥${CUSTOM_RECHARGE_MIN_YUAN}-¥${CUSTOM_RECHARGE_MAX_YUAN} 之间的整数`,
        },
        { status: 400 },
      );
    }
    item = {
      kind: "RECHARGE",
      itemCode: `PTS_CUSTOM_${yuan}`,
      amountCny: yuan * 100,
      pts: yuan * PTS_PER_YUAN,
    };
  } else if (code && isItemCode(code)) {
    const fixed = PRICING[code];
    item = {
      kind: fixed.kind,
      itemCode: fixed.code,
      amountCny: fixed.amountCny,
      pts: fixed.meta?.pts,
      giftPts: fixed.meta?.giftPts,
      vipDays: fixed.meta?.vipDays,
      vipTier: fixed.meta?.vipTier,
    };
  } else {
    return NextResponse.json({ error: "商品代码无效" }, { status: 400 });
  }

  // 防抖：3 秒内同用户已有任何订单则拒绝
  const recent = await prisma.order.findFirst({
    where: {
      userId,
      createdAt: { gt: new Date(Date.now() - DEBOUNCE_MS) },
    },
    select: { id: true },
  });
  if (recent) {
    return NextResponse.json(
      { error: "操作过于频繁，请稍后重试" },
      { status: 429 },
    );
  }

  const now = new Date();

  // 1) 先建 PENDING
  const order = await prisma.order.create({
    data: {
      userId,
      type: item.kind,
      itemCode: item.itemCode,
      amountCny: item.amountCny,
      status: "PENDING",
    },
  });

  try {
    // 2) 账户变更 + 标记 PAID 同事务
    await prisma.$transaction(async (tx) => {
      if (item.kind === "RECHARGE" && item.pts) {
        // 算力点充值：直接增加算力点
        await tx.user.update({
          where: { id: userId },
          data: { computePts: { increment: item.pts } },
        });
      } else if (item.kind === "SUBSCRIBE" && item.vipDays) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { vipExpiresAt: true, vipLevel: true },
        });
        const base =
          user?.vipExpiresAt && user.vipExpiresAt.getTime() > now.getTime()
            ? user.vipExpiresAt
            : now;
        const newExpiry = new Date(base.getTime() + item.vipDays * 86400_000);

        // 防降级逻辑：
        // - 当前 ULTRA 在期 + 购买的是 TP-MAX 或 7天体验卡 → 保留 ULTRA 等级（仍延期）
        // - 其他情况用新购档位
        const currentIsUltra =
          !!user &&
          isUltraLevel(user.vipLevel) &&
          !!user.vipExpiresAt &&
          user.vipExpiresAt.getTime() > now.getTime();
        const incomingIsUltra = item.vipTier === "TP_ULTRA";
        const nextLevel =
          currentIsUltra && !incomingIsUltra ? user!.vipLevel : item.itemCode;

        // VIP 开通同时赠送算力点
        const giftPts = item.giftPts ?? 0;

        await tx.user.update({
          where: { id: userId },
          data: {
            vipLevel: nextLevel,
            vipExpiresAt: newExpiry,
            ...(giftPts > 0 ? { computePts: { increment: giftPts } } : {}),
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: now },
      });
    });
  } catch {
    return NextResponse.json({ error: "支付失败，订单挂起" }, { status: 500 });
  }

  await settleCommission(order.id);

  // ── 首次付费邀请人奖励 ──────────────────────────────────────────────────────
  // 如果买家有邀请人（parentAgentId），且这是买家的第一笔付费订单，
  // 则给邀请人额外奖励 INVITER_FIRST_PAY_BONUS_PTS 算力点。
  try {
    const buyer = await prisma.user.findUnique({
      where: { id: userId },
      select: { parentAgentId: true },
    });
    if (buyer?.parentAgentId) {
      // 统计买家历史付费订单数（不含本次，本次已 PAID）
      const prevPaidCount = await prisma.order.count({
        where: {
          userId,
          status: "PAID",
          id: { not: order.id }, // 排除本次
        },
      });
      // 首次付费（之前没有其他 PAID 订单）
      if (prevPaidCount === 0) {
        await prisma.user.update({
          where: { id: buyer.parentAgentId },
          data: { computePts: { increment: INVITER_FIRST_PAY_BONUS_PTS } },
        });
      }
    }
  } catch {
    // 奖励失败不影响主流程，静默处理
  }

  return NextResponse.json({ ok: true, orderId: order.id });
}
