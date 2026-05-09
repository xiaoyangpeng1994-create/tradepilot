// 商品定价中心。amountCny 单位为分。
// 算力点汇率：¥1 = 100 pts（即 1 pt = ¥0.01），由 PTS_PER_YUAN 控制。
// 会员体系：FREE / TP-MAX / TP-ULTRA
// 算力点 = AI 调用燃料；VIP = 权限 + 每月赠送算力点

// ─── 会员等级 ────────────────────────────────────────────────────────────────
// FREE            免费用户
// TP_MAX_MONTH    TP-MAX 月付
// TP_MAX_YEAR     TP-MAX 年付
// TP_ULTRA_MONTH  TP-ULTRA 月付
// TP_ULTRA_YEAR   TP-ULTRA 年付

export type ItemCode =
  | "TP_MAX_MONTH"
  | "TP_MAX_YEAR"
  | "TP_ULTRA_MONTH"
  | "TP_ULTRA_YEAR"
  | "PTS_29"
  | "PTS_99"
  | "PTS_199"
  | "PTS_499";

export type ItemKind = "SUBSCRIBE" | "RECHARGE";

export interface PricingItem {
  code: ItemCode;
  kind: ItemKind;
  name: string;
  amountCny: number; // 分
  meta?: {
    pts?: number;       // 充值获得的算力点（含赠送）
    bonusPts?: number;  // 赠送部分（仅用于 UI 展示）
    vipDays?: number;
    giftPts?: number;   // VIP 开通时赠送的算力点
    vipTier?: "TP_MAX" | "TP_ULTRA"; // 对应的 VIP 档位
  };
}

// ─── 汇率 ────────────────────────────────────────────────────────────────────
// 1 元 = 100 点（基础汇率，充值包含赠送部分超出此比例）
export const PTS_PER_YUAN = 100;

// ─── 扣点规则（AI 调用燃料）────────────────────────────────────────────────
// 不在用户界面强调"本次花了多少钱"，只显示：本次消耗多少点 / 用于什么能力 / 剩余多少点
export const COST_BASIC_QA_PT = 20;          // 基础短答
export const COST_KEYPOINT_PT = 60;          // 标准点位分析
export const COST_POSITION_RISK_PT = 100;    // 持仓风险判断
export const COST_IMAGE_PT = 300;            // 图片 K 线分析
export const COST_DAILY_PLAN_PT = 400;       // 今日交易观察计划（300-500 取中值）
export const COST_TRADE_REVIEW_PT = 500;     // 最近 5 笔交易复盘
export const COST_DEEP_PATH_PT = 1000;       // TP-ULTRA 深度路径推演（800-1200 取中值）

// 兼容旧引用（ChatWindow 等处使用 COST_TEXT_PT / COST_IMAGE_PT）
export const COST_TEXT_PT = COST_BASIC_QA_PT;

// ─── 注册赠送 ────────────────────────────────────────────────────────────────
// schema.User.computePts @default 必须与此保持一致，改这里同步改 schema
// 内测期间调高至 2000，让好友有足够点数体验所有功能
export const SIGNUP_BONUS_PTS = 2000;
/** 好友通过邀请链接注册成功后，邀请人获得的算力奖励 */
export const INVITER_BONUS_PTS = 500;
/** 好友首次付费（任意订单）后，邀请人额外获得的算力奖励 */
export const INVITER_FIRST_PAY_BONUS_PTS = 500;

// ─── 低余额预警阈值 ──────────────────────────────────────────────────────────
// 约还能做 3 次基础问答（60/20=3）触发红线警示
export const LOW_BALANCE_WARN_PT = 60;

// ─── 自定义充值范围（元）────────────────────────────────────────────────────
export const CUSTOM_RECHARGE_MIN_YUAN = 1;
export const CUSTOM_RECHARGE_MAX_YUAN = 10000;

// ─── 商品目录 ────────────────────────────────────────────────────────────────
export const PRICING: Record<ItemCode, PricingItem> = {
  // ── TP-MAX ──────────────────────────────────────────────────────────────
  TP_MAX_MONTH: {
    code: "TP_MAX_MONTH",
    kind: "SUBSCRIBE",
    name: "TP-MAX 月付",
    amountCny: 19900, // 内测价 ¥199/月（正式价 ¥299）
    meta: { vipDays: 30, giftPts: 30000, vipTier: "TP_MAX" },
  },
  TP_MAX_YEAR: {
    code: "TP_MAX_YEAR",
    kind: "SUBSCRIBE",
    name: "TP-MAX 年付",
    amountCny: 299900, // ¥2,999/年
    meta: { vipDays: 365, giftPts: 360000, vipTier: "TP_MAX" },
  },
  // ── TP-ULTRA ─────────────────────────────────────────────────────────────
  TP_ULTRA_MONTH: {
    code: "TP_ULTRA_MONTH",
    kind: "SUBSCRIBE",
    name: "TP-ULTRA 月付",
    amountCny: 59900, // 内测价 ¥599/月（正式价 ¥999）
    meta: { vipDays: 30, giftPts: 120000, vipTier: "TP_ULTRA" },
  },
  TP_ULTRA_YEAR: {
    code: "TP_ULTRA_YEAR",
    kind: "SUBSCRIBE",
    name: "TP-ULTRA 年付",
    amountCny: 999900, // ¥9,999/年
    meta: { vipDays: 365, giftPts: 1440000, vipTier: "TP_ULTRA" },
  },

  // ── 算力点充值包 ──────────────────────────────────────────────────────────
  // 展示时突出赠送：¥99 = 10,000 + 赠2,000；¥199 = 20,000 + 赠8,000；¥499 = 50,000 + 赠30,000
  PTS_29: {
    code: "PTS_29",
    kind: "RECHARGE",
    name: "算力点 ¥29",
    amountCny: 2900,
    meta: { pts: 3000, bonusPts: 100 },
  },
  PTS_99: {
    code: "PTS_99",
    kind: "RECHARGE",
    name: "算力点 ¥99",
    amountCny: 9900,
    meta: { pts: 12000, bonusPts: 2100 },
  },
  PTS_199: {
    code: "PTS_199",
    kind: "RECHARGE",
    name: "算力点 ¥199",
    amountCny: 19900,
    meta: { pts: 28000, bonusPts: 8100 },
  },
  PTS_499: {
    code: "PTS_499",
    kind: "RECHARGE",
    name: "算力点 ¥499",
    amountCny: 49900,
    meta: { pts: 80000, bonusPts: 30100 },
  },
};

// ─── 工具函数 ────────────────────────────────────────────────────────────────

export function isItemCode(code: string): code is ItemCode {
  return code in PRICING;
}

/** 判断 vipLevel 是否为 TP-ULTRA 档 */
export function isUltraLevel(vipLevel: string): boolean {
  return vipLevel === "TP_ULTRA_MONTH" || vipLevel === "TP_ULTRA_YEAR";
}

/** 判断 vipLevel 是否为 TP-MAX 档 */
export function isMaxLevel(vipLevel: string): boolean {
  return vipLevel === "TP_MAX_MONTH" || vipLevel === "TP_MAX_YEAR";
}

/** 判断 vipLevel 是否为任意付费档 */
export function isPaidLevel(vipLevel: string): boolean {
  return isMaxLevel(vipLevel) || isUltraLevel(vipLevel);
}

/** 获取 vipLevel 的展示名称 */
export function getVipDisplayName(vipLevel: string): string {
  if (isUltraLevel(vipLevel)) return "TP-ULTRA";
  if (isMaxLevel(vipLevel)) return "TP-MAX";
  return "FREE";
}

/** 兼容旧代码：isProPlusLevel → isUltraLevel */
export const isProPlusLevel = isUltraLevel;

export function fenToYuan(fen: number): string {
  return (fen / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: fen % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
