import { prisma } from "./prisma";
import type { TradingStyle } from "./qianwen";

export const SETUP_OPTIONS = [
  "OB 回踩",
  "FVG 填补",
  "流动性扫损",
  "MSB / CHoCH",
  "突破回踩",
  "趋势延续",
  "区间反转",
  "其他",
] as const;

export const TIMEFRAME_OPTIONS = ["15m", "1h", "4h", "1d", "weekly"] as const;

export type Direction = "LONG" | "SHORT";
export type TradeStatus = "OPEN" | "CLOSED";

export type TradeRow = {
  id: string;
  symbol: string;
  channel: string | null;
  direction: Direction;
  entryPrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  exitPrice: number | null;
  pnlPct: number | null;
  status: TradeStatus;
  setup: string | null;
  timeframe: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
};

/**
 * 给一笔已成交的交易计算盈亏%。
 * LONG: (exit - entry) / entry × 100
 * SHORT: (entry - exit) / entry × 100
 */
export function computePnlPct(direction: Direction, entry: number, exit: number): number {
  const raw = (exit - entry) / entry;
  return direction === "LONG" ? raw * 100 : -raw * 100;
}

export type AggregateStats = {
  totalClosed: number;
  totalOpen: number;
  winRate: number; // 0-100
  avgPnlPct: number; // 含正负
  bestPct: number | null;
  worstPct: number | null;
  bySetup: Array<{ setup: string; count: number; winRate: number; avgPnlPct: number }>;
  bySymbol: Array<{ symbol: string; count: number; winRate: number; avgPnlPct: number }>;
  // ── 新增画像字段 ──────────────────────────────────────────────────────────
  /** 平均持仓时长（小时），null = 没有已平仓数据 */
  avgHoldHours: number | null;
  /** 做多比例 0-100，null = 没有数据 */
  longRatioPct: number | null;
  /** 最近 3 笔已平仓的平均盈亏%，null = 不足 3 笔 */
  recentMoodPct: number | null;
  /** 最近 5 笔胜率 0-100，null = 不足 5 笔 */
  recentWinRate: number | null;
  /** 止损填写率 0-100（有 stopPrice 的笔数 / 总笔数），null = 没有数据 */
  stopLossRatePct: number | null;
  /** 最常用时间周期，null = 没有数据 */
  topTimeframe: string | null;
};

export function aggregateStats(trades: Pick<TradeRow, "status" | "pnlPct" | "setup" | "symbol">[]): AggregateStats {
  const closed = trades.filter((t) => t.status === "CLOSED" && t.pnlPct != null);
  const open = trades.filter((t) => t.status === "OPEN").length;
  const totalClosed = closed.length;

  if (totalClosed === 0) {
    return {
      totalClosed: 0,
      totalOpen: open,
      winRate: 0,
      avgPnlPct: 0,
      bestPct: null,
      worstPct: null,
      bySetup: [],
      bySymbol: [],
      avgHoldHours: null,
      longRatioPct: null,
      recentMoodPct: null,
      recentWinRate: null,
      stopLossRatePct: null,
      topTimeframe: null,
    };
  }

  const wins = closed.filter((t) => (t.pnlPct ?? 0) > 0).length;
  const sumPnl = closed.reduce((s, t) => s + (t.pnlPct ?? 0), 0);
  const pnls = closed.map((t) => t.pnlPct as number);

  // 按 setup 分组
  const setupMap = new Map<string, number[]>();
  for (const t of closed) {
    const key = t.setup ?? "未标注";
    if (!setupMap.has(key)) setupMap.set(key, []);
    setupMap.get(key)!.push(t.pnlPct as number);
  }
  const bySetup = Array.from(setupMap.entries())
    .map(([setup, list]) => ({
      setup,
      count: list.length,
      winRate: (list.filter((p) => p > 0).length / list.length) * 100,
      avgPnlPct: list.reduce((s, x) => s + x, 0) / list.length,
    }))
    .sort((a, b) => b.count - a.count);

  // 按 symbol 分组
  const symMap = new Map<string, number[]>();
  for (const t of closed) {
    const key = t.symbol;
    if (!symMap.has(key)) symMap.set(key, []);
    symMap.get(key)!.push(t.pnlPct as number);
  }
  const bySymbol = Array.from(symMap.entries())
    .map(([symbol, list]) => ({
      symbol,
      count: list.length,
      winRate: (list.filter((p) => p > 0).length / list.length) * 100,
      avgPnlPct: list.reduce((s, x) => s + x, 0) / list.length,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    totalClosed,
    totalOpen: open,
    winRate: (wins / totalClosed) * 100,
    avgPnlPct: sumPnl / totalClosed,
    bestPct: Math.max(...pnls),
    worstPct: Math.min(...pnls),
    bySetup,
    bySymbol,
    avgHoldHours: null,   // aggregateStats 只接收精简字段，持仓时长由 buildTraderProfile 单独计算
    longRatioPct: null,   // 同上，direction 字段未传入此函数
    recentMoodPct: null,  // 同上，需要有序数据
    recentWinRate: null,  // 同上
    stopLossRatePct: null,// 同上，stopPrice 字段未传入此函数
    topTimeframe: null,   // 同上，timeframe 字段未传入此函数
  };
}

// ── 完整画像统计（接收含 direction / stopPrice / timeframe / openedAt / closedAt 的完整行）──

export type FullTradeRow = {
  status: TradeStatus;
  pnlPct: number | null;
  setup: string | null;
  symbol: string;
  direction: string;
  stopPrice: number | null;
  timeframe: string | null;
  openedAt: string | Date;
  closedAt: string | Date | null;
};

/**
 * 从完整 Trade 数据计算画像统计，返回填充了所有新字段的 AggregateStats。
 * 供 /api/trades/stats 接口使用。
 */
export function aggregateStatsFull(trades: FullTradeRow[]): AggregateStats {
  // 先用精简字段跑基础统计
  const base = aggregateStats(
    trades.map((t) => ({
      status: t.status,
      pnlPct: t.pnlPct,
      setup: t.setup,
      symbol: t.symbol,
    })),
  );

  const total = trades.length;
  if (total === 0) return base;

  // 做多比例
  const longCount = trades.filter((t) => t.direction === "LONG").length;
  const longRatioPct = (longCount / total) * 100;

  // 止损填写率
  const stopCount = trades.filter((t) => t.stopPrice != null).length;
  const stopLossRatePct = (stopCount / total) * 100;

  // 最常用时间周期
  const tfMap = new Map<string, number>();
  for (const t of trades) {
    if (t.timeframe) tfMap.set(t.timeframe, (tfMap.get(t.timeframe) ?? 0) + 1);
  }
  const topTimeframe =
    tfMap.size > 0
      ? Array.from(tfMap.entries()).sort((a, b) => b[1] - a[1])[0][0]
      : null;

  // 平均持仓时长（小时）
  const closedWithTime = trades.filter(
    (t) => t.status === "CLOSED" && t.closedAt != null,
  );
  let avgHoldHours: number | null = null;
  if (closedWithTime.length > 0) {
    const totalMs = closedWithTime.reduce((sum, t) => {
      const open = new Date(t.openedAt).getTime();
      const close = new Date(t.closedAt!).getTime();
      return sum + Math.max(0, close - open);
    }, 0);
    avgHoldHours = totalMs / closedWithTime.length / 3_600_000;
  }

  // 最近 3 笔已平仓平均盈亏（按 openedAt 倒序取前 3）
  const closedSorted = trades
    .filter((t) => t.status === "CLOSED" && t.pnlPct != null)
    .sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

  let recentMoodPct: number | null = null;
  if (closedSorted.length >= 3) {
    const recent3 = closedSorted.slice(0, 3);
    recentMoodPct = recent3.reduce((s, t) => s + (t.pnlPct as number), 0) / 3;
  }

  // 最近 5 笔胜率
  let recentWinRate: number | null = null;
  if (closedSorted.length >= 5) {
    const recent5 = closedSorted.slice(0, 5);
    recentWinRate = (recent5.filter((t) => (t.pnlPct as number) > 0).length / 5) * 100;
  }

  return {
    ...base,
    avgHoldHours,
    longRatioPct,
    recentMoodPct,
    recentWinRate,
    stopLossRatePct,
    topTimeframe,
  };
}

// ── 画像完成度 ────────────────────────────────────────────────────────────────

export type ProfileCompletionInput = {
  totalTrades: number;
  totalClosed: number;
  setupFilledCount: number;   // 填写了 setup 的笔数
  stopFilledCount: number;    // 填写了 stopPrice 的笔数
  timeframeFilledCount: number; // 填写了 timeframe 的笔数
  notesFilledCount: number;   // 填写了 notes 的笔数
  uniqueSetupCount: number;   // 不同 setup 的种类数
};

/**
 * 计算画像完成度百分比（0-100）。
 * 规则见 P2.4A 方案第 4 节。
 */
export function computeProfileCompletion(input: ProfileCompletionInput): number {
  let score = 0;
  if (input.totalTrades >= 1) score += 10;
  if (input.totalClosed >= 3) score += 15;
  if (input.totalClosed >= 5) score += 15;
  if (input.totalClosed >= 10) score += 15;
  if (input.setupFilledCount >= 3) score += 10;
  if (input.stopFilledCount >= 3) score += 10;
  if (input.timeframeFilledCount >= 3) score += 10;
  if (input.notesFilledCount >= 3) score += 10;
  if (input.uniqueSetupCount >= 3) score += 5;
  return Math.min(100, score);
}

/** 完成度对应的文案 */
export function profileCompletionLabel(pct: number): string {
  if (pct <= 20) return "AI 刚认识你，继续记录吧";
  if (pct <= 40) return "AI 开始了解你的交易风格";
  if (pct <= 60) return "AI 已经能看出一些规律了";
  if (pct <= 80) return "AI 对你的了解越来越深";
  if (pct < 100) return "AI 画像接近完整，细节越来越准";
  return "AI 画像已完整，持续更新中";
}

export type ProfileTier = "free" | "vip" | "vip_plus";

// 交易风格中文映射
const STYLE_LABEL: Record<string, string> = {
  INTRADAY: "日内短线",
  SWING: "波段交易",
  POSITION: "趋势持仓",
  LEARNING: "学习观察中",
};

/**
 * 给 AI 注入的"用户交易档案"——浓缩版统计 + 当前持仓快照。
 *
 * 紧化预算（单段紧凑、无冗余前缀，让 AI 能精准引用某条事实）：
 * - free: ≤120 token —— 交易风格 + 总体一行 + 优势 setup + 持仓数（不展开）
 * - vip:  ≤250 token —— + 弱势 setup + Top2 by symbol + 5 笔持仓详情 + 连亏告警
 * - vip_plus: ≤500 token —— + Top3 by symbol + 周期偏好 + 失败模式 + 无止损告警 + 连亏明细
 *
 * 注意：本函数只输出**事实数据**。如何引用这些数据的指令在 BASE_PERSONA
 * 的"自然引用用户档案"段，避免每个用户每次重复送相同指令文本。
 *
 * 返回空字符串 = 该用户还没有任何交易记录，无需注入。
 */
export async function buildTraderProfile(
  userId: string,
  tier: ProfileTier = "free",
  tradingStyle?: TradingStyle,
): Promise<string> {
  const trades = await prisma.trade.findMany({
    where: { userId },
    orderBy: { openedAt: "desc" },
    take: 50,
    select: {
      symbol: true,
      direction: true,
      entryPrice: true,
      stopPrice: true,
      pnlPct: true,
      status: true,
      setup: true,
      timeframe: true,
    },
  });

  if (trades.length === 0) return "";

  const stats = aggregateStats(
    trades.map((t) => ({
      status: t.status as TradeStatus,
      pnlPct: t.pnlPct,
      setup: t.setup,
      symbol: t.symbol,
    })),
  );

  const lines: string[] = [`# 用户档案`];

  // 交易风格标签（所有 tier）
  if (tradingStyle) {
    const label = STYLE_LABEL[tradingStyle] ?? tradingStyle;
    lines.push(`交易风格：${label}`);
  }

  if (stats.totalClosed === 0) {
    lines.push(`持仓 ${stats.totalOpen} 笔（暂无已平仓样本）`);
  } else {
    // 总体一行
    lines.push(
      `${trades.length} 笔交易（已平 ${stats.totalClosed}，胜率 ${stats.winRate.toFixed(0)}%，均收益 ${stats.avgPnlPct >= 0 ? "+" : ""}${stats.avgPnlPct.toFixed(2)}%）`,
    );

    // setup 强弱（FREE 只给优势；VIP/ULTRA 同时给弱势）
    const ranked = stats.bySetup.filter((s) => s.count >= 3);
    if (ranked.length > 0) {
      const best = ranked.reduce((a, b) => (a.winRate > b.winRate ? a : b));
      const setupParts = [`优势"${best.setup}"`];
      if (tier !== "free") {
        const worst = ranked.reduce((a, b) => (a.winRate < b.winRate ? a : b));
        if (worst.setup !== best.setup && worst.winRate < 40) {
          setupParts.push(`弱势"${worst.setup}"（胜率 ${worst.winRate.toFixed(0)}%）`);
        }
      }
      lines.push(setupParts.join(" / "));
    }

    // by symbol（仅 VIP / ULTRA）
    if (tier !== "free" && stats.bySymbol.length > 0) {
      const limit = tier === "vip_plus" ? 3 : 2;
      const top = stats.bySymbol.slice(0, limit);
      lines.push(
        `主做 ${top.map((s) => `${s.symbol}(×${s.count} 胜 ${s.winRate.toFixed(0)}%)`).join(" / ")}`,
      );
    }

    // 周期偏好 + 失败模式聚类（仅 ULTRA）
    if (tier === "vip_plus") {
      const tfMap = new Map<string, number>();
      for (const t of trades) {
        if (t.timeframe) tfMap.set(t.timeframe, (tfMap.get(t.timeframe) ?? 0) + 1);
      }
      if (tfMap.size > 0) {
        const sorted = Array.from(tfMap.entries()).sort((a, b) => b[1] - a[1]);
        lines.push(
          `周期偏好 ${sorted.slice(0, 3).map(([tf, c]) => `${tf}×${c}`).join(" / ")}`,
        );
      }

      const failures = stats.bySetup.filter((s) => s.count >= 3 && s.winRate < 30);
      if (failures.length > 0) {
        lines.push(
          `⚠ 失败模式 ${failures.map((s) => `"${s.setup}"`).join(", ")}（连续低胜率，遇到时显著降仓）`,
        );
      }
    }
  }

  // 近期连亏检测（仅 vip / vip_plus，复用已有 trades 数组，零额外 DB 查询）
  if (tier !== "free" && stats.totalClosed >= 3) {
    const recentClosed = trades
      .filter((t) => t.status === "CLOSED" && t.pnlPct != null)
      .slice(0, 5); // trades 已按 openedAt desc 排序，取最近 5 笔已平仓
    // 从最新往前数连续亏损笔数
    let streak = 0;
    for (const t of recentClosed) {
      if ((t.pnlPct ?? 0) < 0) streak++;
      else break;
    }
    if (streak >= 3) {
      lines.push(`⚠ 近期连亏 ${streak} 笔，建议降低仓位或暂停交易`);
      if (tier === "vip_plus") {
        const detail = recentClosed
          .map((t) => {
            const p = t.pnlPct as number;
            return `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`;
          })
          .join(" / ");
        lines.push(`最近 ${recentClosed.length} 笔：${detail}`);
      }
    }
  }

  // 持仓
  const open = trades.filter((t) => t.status === "OPEN");
  if (open.length > 0) {
    if (tier === "free") {
      // FREE：只给数量
      lines.push(`持仓 ${open.length} 笔（详情未展开）`);
    } else {
      // VIP / ULTRA 展开 5 笔；ULTRA 额外标无止损告警
      const noStop = open.filter((t) => t.stopPrice == null).length;
      const noStopWarn =
        tier === "vip_plus" && noStop > 0
          ? `（其中 ${noStop} 笔无止损 ⚠）`
          : "";
      lines.push(`持仓 ${open.length} 笔${noStopWarn}：`);
      for (const t of open.slice(0, 5)) {
        const stopText = t.stopPrice != null
          ? `止损 ${t.stopPrice}`
          : tier === "vip_plus" ? "无止损" : "";
        const detailParts = [stopText, t.timeframe, t.setup].filter(Boolean);
        const detail = detailParts.length > 0 ? `（${detailParts.join(" · ")}）` : "";
        lines.push(`- ${t.symbol} ${t.direction} @${t.entryPrice}${detail}`);
      }
    }
  }

  return `<user_profile>\n${lines.join("\n")}\n</user_profile>`;
}
