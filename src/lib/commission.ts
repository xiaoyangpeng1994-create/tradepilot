import { prisma } from "./prisma";

// ─── 分成比例 ────────────────────────────────────────────────────────────────
// 会员订阅（SUBSCRIBE）：利润空间大，分成比例高
const SUBSCRIBE_RATE_L1 = 0.20; // 一级代理 20%
const SUBSCRIBE_RATE_L2 = 0.10; // 二级代理 10%

// 算力点充值（RECHARGE）：直接对应模型成本，分成比例低
const RECHARGE_RATE_L1 = 0.10;  // 一级代理 10%
const RECHARGE_RATE_L2 = 0.05;  // 二级代理 5%

export async function settleCommission(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PAID") return;

  const buyer = await prisma.user.findUnique({ where: { id: order.userId } });
  if (!buyer) return;

  // 根据订单类型选择分成比例
  const isRecharge = order.type === "RECHARGE";
  const rateL1 = isRecharge ? RECHARGE_RATE_L1 : SUBSCRIBE_RATE_L1;
  const rateL2 = isRecharge ? RECHARGE_RATE_L2 : SUBSCRIBE_RATE_L2;

  const logs: { recipientId: string; level: number; rate: number; amount: number }[] = [];

  if (buyer.parentAgentId) {
    logs.push({
      recipientId: buyer.parentAgentId,
      level: 1,
      rate: rateL1,
      amount: Math.round(order.amountCny * rateL1),
    });

    const lvl1 = await prisma.user.findUnique({ where: { id: buyer.parentAgentId } });
    if (lvl1?.parentAgentId) {
      logs.push({
        recipientId: lvl1.parentAgentId,
        level: 2,
        rate: rateL2,
        amount: Math.round(order.amountCny * rateL2),
      });
    }
  }

  for (const l of logs) {
    const typeLabel = isRecharge ? "算力点充值" : "会员订阅";
    const note = `来自 ${buyer.nickname} 的 ${typeLabel} 订单 ${order.id} · ${
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
    // TP-MAX
    case "TP_MAX_MONTH":
      return { vipLevel: "TP_MAX_MONTH", vipDays: 30, addPts: 30000 };
    case "TP_MAX_YEAR":
      return { vipLevel: "TP_MAX_YEAR", vipDays: 365, addPts: 360000 };
    // TP-ULTRA
    case "TP_ULTRA_MONTH":
      return { vipLevel: "TP_ULTRA_MONTH", vipDays: 30, addPts: 120000 };
    case "TP_ULTRA_YEAR":
      return { vipLevel: "TP_ULTRA_YEAR", vipDays: 365, addPts: 1440000 };
    // 算力点充值包
    case "PTS_29":
      return { addPts: 3000 };
    case "PTS_99":
      return { addPts: 12000 };
    case "PTS_199":
      return { addPts: 28000 };
    case "PTS_499":
      return { addPts: 80000 };
    default:
      return {};
  }
}
