import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRICING, isItemCode } from "@/lib/pricing";
import { settleCommission } from "@/lib/commission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEBOUNCE_MS = 3000;

// 开发模式下单 + 立即模拟支付。
// 真实支付链路上线后：拆成 /api/order/create 创建 PENDING + 支付网关 webhook 标记 PAID 并触发 settle。
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { itemCode?: string } | null;
  const code = body?.itemCode;
  if (!code || !isItemCode(code)) {
    return NextResponse.json({ error: "商品代码无效" }, { status: 400 });
  }

  // 防抖：3 秒内同用户已有任何订单则拒绝（PENDING/PAID 都算）。
  // 之前只查 PENDING 状态，但订单 PENDING→PAID 翻转太快，几乎拦不住，故放宽到全部状态。
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

  const item = PRICING[code];
  const now = new Date();

  // 1) 先建 PENDING
  const order = await prisma.order.create({
    data: {
      userId,
      type: item.kind,
      itemCode: item.code,
      amountCny: item.amountCny,
      status: "PENDING",
    },
  });

  try {
    // 2) 应用账户变更 + 标记 PAID（账户改动和订单状态翻转尽量同事务）
    await prisma.$transaction(async (tx) => {
      if (item.kind === "RECHARGE" && item.meta?.pts) {
        await tx.user.update({
          where: { id: userId },
          data: { computePts: { increment: item.meta.pts } },
        });
      } else if (item.kind === "SUBSCRIBE" && item.meta?.vipDays) {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { vipExpiresAt: true },
        });
        const base =
          user?.vipExpiresAt && user.vipExpiresAt.getTime() > now.getTime()
            ? user.vipExpiresAt
            : now;
        const newExpiry = new Date(base.getTime() + item.meta.vipDays * 86400_000);
        await tx.user.update({
          where: { id: userId },
          data: {
            vipLevel: item.code,
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
    // 失败时把订单留在 PENDING，等运营/任务清理；不阻塞前端
    return NextResponse.json({ error: "支付失败，订单挂起" }, { status: 500 });
  }

  // 3) 分润（独立于上面的事务，失败不影响订单已支付的事实）
  await settleCommission(order.id);

  return NextResponse.json({ ok: true, orderId: order.id });
}
