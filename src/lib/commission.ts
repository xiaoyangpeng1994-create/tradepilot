import { prisma } from "./prisma";

const RATE_LEVEL_1 = 0.2;  // 直推 20%
const RATE_LEVEL_2 = 0.1;  // 二级 10%

export async function settleCommission(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PAID") return;

  const buyer = await prisma.user.findUnique({ where: { id: order.userId } });
  if (!buyer) return;

  const logs: { recipientId: string; level: number; rate: number; amount: number }[] = [];

  if (buyer.parentAgentId) {
    logs.push({
      recipientId: buyer.parentAgentId,
      level: 1,
      rate: RATE_LEVEL_1,
      amount: Math.round(order.amountCny * RATE_LEVEL_1),
    });

    const lvl1 = await prisma.user.findUnique({ where: { id: buyer.parentAgentId } });
    if (lvl1?.parentAgentId) {
      logs.push({
        recipientId: lvl1.parentAgentId,
        level: 2,
        rate: RATE_LEVEL_2,
        amount: Math.round(order.amountCny * RATE_LEVEL_2),
      });
    }
  }

  for (const l of logs) {
    const note = `来自 ${buyer.nickname} 的 ${order.itemCode} 订单 ${order.id} · ${
      l.level === 1 ? "直推" : "二级"
    } ${(l.rate * 100).toFixed(0)}%`;

    await prisma.commissionLog.create({
      data: {
        orderId: order.id,
        recipientId: l.recipientId,
        payerId: buyer.id,
        payerNickname: buyer.nickname,
        rate: l.rate,
        amountCny: l.amount,
        level: l.level,
        note,
      },
    });
    await prisma.user.update({
      where: { id: l.recipientId },
      data: { walletBalance: { increment: l.amount } },
    });
  }
}

export function applyOrderEffects(itemCode: string) {
  switch (itemCode) {
    case "PRO_MONTH":
      return { vipLevel: "PRO_MONTH", vipDays: 30 };
    case "PRO_YEAR":
      return { vipLevel: "PRO_YEAR", vipDays: 365 };
    case "PTS_500":
      return { addPts: 500 };
    case "PTS_2000":
      return { addPts: 2000 };
    case "PTS_5000":
      return { addPts: 5000 };
    case "PTS_20000":
      return { addPts: 20000 };
    default:
      return {};
  }
}
