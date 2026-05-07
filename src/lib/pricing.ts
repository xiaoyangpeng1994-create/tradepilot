// 商品定价中心。amountCny 单位为分。
// 后续接真实支付时只需改这里 + /api/order/checkout 的支付链路。

export type ItemCode =
  | "PRO_MONTH"
  | "PRO_YEAR"
  | "PTS_500"
  | "PTS_2000"
  | "PTS_5000"
  | "PTS_20000";

export type ItemKind = "SUBSCRIBE" | "RECHARGE";

export interface PricingItem {
  code: ItemCode;
  kind: ItemKind;
  name: string;
  amountCny: number; // 分
  meta?: { pts?: number; vipDays?: number };
}

export const PRICING: Record<ItemCode, PricingItem> = {
  PRO_MONTH: {
    code: "PRO_MONTH",
    kind: "SUBSCRIBE",
    name: "月度专业版",
    amountCny: 59900,
    meta: { vipDays: 30 },
  },
  PRO_YEAR: {
    code: "PRO_YEAR",
    kind: "SUBSCRIBE",
    name: "年度旗舰版",
    amountCny: 499900,
    meta: { vipDays: 365 },
  },
  PTS_500: { code: "PTS_500", kind: "RECHARGE", name: "算力 500 点", amountCny: 1000, meta: { pts: 500 } },
  PTS_2000: { code: "PTS_2000", kind: "RECHARGE", name: "算力 2,000 点", amountCny: 3500, meta: { pts: 2000 } },
  PTS_5000: { code: "PTS_5000", kind: "RECHARGE", name: "算力 5,000 点", amountCny: 8000, meta: { pts: 5000 } },
  PTS_20000: { code: "PTS_20000", kind: "RECHARGE", name: "算力 20,000 点", amountCny: 29900, meta: { pts: 20000 } },
};

export function fenToYuan(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function isItemCode(x: string): x is ItemCode {
  return x in PRICING;
}
