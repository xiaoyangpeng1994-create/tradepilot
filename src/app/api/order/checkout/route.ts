import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  PRICING,
  isItemCode,
  PTS_PER_YUAN,
  CUSTOM_RECHARGE_MIN_YUAN,
  CUSTOM_RECHARGE_MAX_YUAN,
} from "@/lib/pricing";
import { settleCommission } from "@/lib/commission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEBOUNCE_MS = 3000;

type ResolvedItem = {
  kind: "SUBSCRIBE" | "RECHARGE";
  itemCode: string;
  amountCny: number;
  pts?: number;
  vipDays?: number;
};

// 开发模式下单 + 立即模拟支付。
// 真实支付链路上线后：拆成 /api/order/create 创建 PENDING + 支付网关 webhook 标记 PAID 并触发 settle。
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { itemCode?: string; customAmountYuan?: number }
    | null;
  const code = body?.itemCode;

  // 解析商品：固定档位 or 自定义
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
      vipDays: fixed.meta?.vipDays,
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
        await tx.user.update({
          where: { id: userId },
          data: { computePts: { increment: item.pts } },
        });
      } else if (item.kind === "SUBSCRIBE" && item.vipDays) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { vipExpiresAt: true },
        });
        const base =
          user?.vipExpiresAt && user.vipExpiresAt.getTime() > now.getTime()
            ? user.vipExpiresAt
            : now;
        const newExpiry = new Date(base.getTime() + item.vipDays * 86400_000);
        await tx.user.update({
          where: { id: userId },
          data: {
            vipLevel: item.itemCode,
            vipExpiresAt: newExpiry,
          },
        });
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: "PAID", paidAt: now },
      });
    });
  } catch (e) {
    return NextResponse.json({ error: "支付失败，订单挂起" }, { status: 500 });
  }

  await settleCommission(order.id);

  return NextResponse.json({ ok: true, orderId: order.id });
}
