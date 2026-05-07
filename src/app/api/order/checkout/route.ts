import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PRICING, isItemCode } from "@/lib/pricing";
import { settleCommission } from "@/lib/commission";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const item = PRICING[code];
  const now = new Date();

  const order = await prisma.order.create({
    data: {
      userId,
      type: item.kind,
      itemCode: item.code,
      amountCny: item.amountCny,
      status: "PAID",
      paidAt: now,
    },
  });

  if (item.kind === "RECHARGE" && item.meta?.pts) {
    await prisma.user.update({
      where: { id: userId },
      data: { computePts: { increment: item.meta.pts } },
    });
  } else if (item.kind === "SUBSCRIBE" && item.meta?.vipDays) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { vipExpiresAt: true },
    });
    const base =
      user?.vipExpiresAt && user.vipExpiresAt.getTime() > now.getTime()
        ? user.vipExpiresAt
        : now;
    const newExpiry = new Date(base.getTime() + item.meta.vipDays * 86400_000);
    await prisma.user.update({
      where: { id: userId },
      data: {
        vipLevel: item.code,
        vipExpiresAt: newExpiry,
      },
    });
  }

  await settleCommission(order.id);

  return NextResponse.json({ ok: true, orderId: order.id });
}
