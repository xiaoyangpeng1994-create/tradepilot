// 商品定价中心。amountCny 单位为分。
// 当前算力点汇率：¥1 = 50 pts（即 1 pt = ¥0.02），由 PTS_PER_YUAN 控制。
// 自定义金额走 /api/order/checkout 的 PTS_CUSTOM 路径。

export type ItemCode =
  | "PRO_MONTH"
  | "PRO_YEAR"
  | "PRO_PLUS_MONTH"
  | "PRO_PLUS_YEAR"
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

// 单次推理成本（pt）。改这里全站联动：UI 文案、chat route 扣点、A/D 钩子阈值都从此处读。
export const COST_TEXT_PT = 33;
export const COST_IMAGE_PT = 65;

// 注册赠送（pt）。schema.User.computePts @default 必须与此保持一致，改这里同步改 schema。
export const SIGNUP_BONUS_PTS = 500;
export const INVITER_BONUS_PTS = 200;

// A 钩子（余额低预警）阈值：约还能问 3 次（100/33≈3）触发红线警示
export const LOW_BALANCE_WARN_PT = 100;

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
  PRO_PLUS_MONTH: {
    code: "PRO_PLUS_MONTH",
    kind: "SUBSCRIBE",
    name: "ULTRA 月度版",
    amountCny: 199900,
    meta: { vipDays: 30 },
  },
  PRO_PLUS_YEAR: {
    code: "PRO_PLUS_YEAR",
    kind: "SUBSCRIBE",
    name: "ULTRA 年度版",
    amountCny: 1799900,
    meta: { vipDays: 365 },
  },
  PTS_50: ptsPack(50),
  PTS_100: ptsPack(100),
  PTS_300: ptsPack(300),
  PTS_500: ptsPack(500),
  PTS_1000: ptsPack(1000),
};

/**
 * 判断 vipLevel 字符串是否对应 ULTRA（PRO_PLUS）档。
 * 注意 vipLevel 是 "FREE" / "PRO_MONTH" / "PRO_YEAR" / "PRO_PLUS_MONTH" / "PRO_PLUS_YEAR"。
 */
export function isProPlusLevel(vipLevel: string): boolean {
  return vipLevel === "PRO_PLUS_MONTH" || vipLevel === "PRO_PLUS_YEAR";
}

export function fenToYuan(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function isItemCode(x: string): x is ItemCode {
  return x in PRICING;
}
