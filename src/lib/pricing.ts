// 商品定价中心。amountCny 单位为分。
// 当前算力点汇率：¥1 = 50 pts（即 1 pt = ¥0.02），由 PTS_PER_YUAN 控制。
// 自定义金额走 /api/order/checkout 的 PTS_CUSTOM 路径。

export type ItemCode =
  | "PRO_MONTH"
  | "PRO_YEAR"
  | "PTS_50"
  | "PTS_100"
  | "PTS_300"
  | "PTS_500"
  | "PTS_1000";

export type ItemKind = "SUBSCRIBE" | "RECHARGE";

export interface PricingItem {
  code: ItemCode;
  kind: ItemKind;
  name: string;
  amountCny: number; // 分
  meta?: { pts?: number; vipDays?: number };
}

export const PTS_PER_YUAN = 50;

// 自定义充值范围（元）
export const CUSTOM_RECHARGE_MIN_YUAN = 1;
export const CUSTOM_RECHARGE_MAX_YUAN = 10000;

function ptsPack(yuan: number): PricingItem {
  return {
    code: `PTS_${yuan}` as ItemCode,
    kind: "RECHARGE",
    name: `充值 ¥${yuan}`,
    amountCny: yuan * 100,
    meta: { pts: yuan * PTS_PER_YUAN },
  };
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
  PTS_50: ptsPack(50),
  PTS_100: ptsPack(100),
  PTS_300: ptsPack(300),
  PTS_500: ptsPack(500),
  PTS_1000: ptsPack(1000),
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
