import { prisma } from "./prisma";

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
  };
}

/**
 * 给 AI 注入的"用户交易档案"——浓缩版统计 + 当前持仓快照。
 * 故意保持紧凑（≤ 500 token），避免吃掉太多 LLM 上下文额度。
 *
 * 返回空字符串 = 该用户还没有任何交易记录，无需注入。
 */
export async function buildTraderProfile(userId: string): Promise<string> {
  // 拉最近 50 笔（已平仓 + 当前未平仓）
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

  const lines: string[] = [];
  lines.push(`# 用户交易档案（基于该用户最近 ${trades.length} 笔交易）`);

  if (stats.totalClosed === 0) {
    lines.push(`- 已平仓样本: 0；未平仓 ${stats.totalOpen} 笔`);
  } else {
    lines.push(
      `- 已平仓 ${stats.totalClosed} 笔，胜率 ${stats.winRate.toFixed(0)}%，平均收益 ${stats.avgPnlPct >= 0 ? "+" : ""}${stats.avgPnlPct.toFixed(2)}%`,
    );

    // 最强 / 最弱 setup（要求至少 3 笔样本，否则无统计意义）
    const ranked = stats.bySetup.filter((s) => s.count >= 3);
    if (ranked.length > 0) {
      const best = ranked.reduce((a, b) => (a.winRate > b.winRate ? a : b));
      const worst = ranked.reduce((a, b) => (a.winRate < b.winRate ? a : b));
      lines.push(
        `- 优势模式: "${best.setup}" ${best.count} 笔，胜率 ${best.winRate.toFixed(0)}%（建议优先推荐）`,
      );
      if (worst.setup !== best.setup && worst.winRate < 40) {
        lines.push(
          `- 弱势模式: "${worst.setup}" ${worst.count} 笔，胜率仅 ${worst.winRate.toFixed(0)}%（用户问到时建议温和提醒"过去样本胜率较低"）`,
        );
      }
    }
  }

  // 当前持仓快照
  const open = trades.filter((t) => t.status === "OPEN");
  if (open.length > 0) {
    lines.push(``, `## 当前未平仓持仓 (${open.length} 笔)`);
    for (const t of open.slice(0, 5)) {
      const stopText = t.stopPrice != null ? `（止损 ${t.stopPrice}）` : "（未设止损 ⚠）";
      lines.push(
        `- ${t.symbol} ${t.direction} 入场 ${t.entryPrice}${stopText}${t.timeframe ? ` · ${t.timeframe}` : ""}${t.setup ? ` · ${t.setup}` : ""}`,
      );
    }
    lines.push(`> 当问题与上述持仓相关时，主动给出"关键位提醒"或"是否该平仓"的建议。`);
  }

  lines.push(
    ``,
    `请基于以上档案进行个性化回答：在交易建议中优先匹配用户优势模式；若问题命中弱势模式或当前持仓，提示用户。`,
  );
  return lines.join("\n");
}
