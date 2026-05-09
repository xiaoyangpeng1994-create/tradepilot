/**
 * 市场情报派生层。纯函数 + 现有数据源（Binance ticker / 黄金 / 外汇）+ 静态风险日历。
 *
 * 设计原则：
 * - 不引入新的外部 API（funding rate / IV 等）
 * - 不假装个性化：用户档案派生句**必须**基于真实交易数据，<3 笔已平仓退化为通用语
 * - 所有标签都是派生的（涨跌幅 → 强势/中性/偏弱；振幅 → 高/中/低波动）
 */
import { prisma } from "./prisma";
import { aggregateStats, type TradeStatus } from "./journal";
import {
  fetchCryptoTickers,
  fetchForexQuotes,
  type CryptoTicker,
} from "./market";
import { fetchGoldQuote, type GoldQuote } from "./gold";
import riskCalendarRaw from "@/data/risk-calendar.json";

// ---------- 类型 ----------

export type RiskRegion = "US" | "EU" | "CN" | "GLOBAL";
export type Importance = "high" | "medium";

export type RiskEvent = {
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  region: RiskRegion;
  name: string;
  importance: Importance;
};

export type ObservationState =
  | "strong"
  | "neutral"
  | "weak"
  | "high-vol"
  | "low-vol"
  | "unknown";

export type Observation = {
  label: string; // "BTC" / "黄金" / "EUR/USD"
  state: ObservationState;
  note: string; // "中性偏强" / "高波动"
};

export type TraderInsight = {
  totalClosed: number;
  totalOpen: number;
  winRatePct: number;
  bestSetup?: string;
  weakestSetup?: string;
  /** 已平仓样本里出现次数最多的 symbol（≥2 笔才填）。例: "BTCUSDT" */
  topSymbol?: string;
  /** 全部 trades 里使用最多的 timeframe（≥2 笔才填）。例: "4h" */
  topTimeframe?: string;
  /** 从最新已平仓往回数的连续亏损笔数（≥2 才填，1 笔不算 streak） */
  recentLossStreak?: number;
  hasOpenPosition: boolean;
};

export type IntelSnapshot = {
  observations: Observation[];
  risks: RiskEvent[]; // 今天 + 明天
  aiNotes: string[]; // 2-3 条
};

// ---------- 时间段判断（北京时间） ----------

export type DayPart = "morning" | "afternoon" | "evening" | "late";

export function getDayPart(now: Date): DayPart {
  // 转北京时间小时（UTC+8）。Date 在 server 端通常是 UTC，在客户端是本地。
  // 用 toLocaleString 强制 Asia/Shanghai。
  const hour = Number(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hour12: false,
    }),
  );
  if (hour >= 4 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 24) return "evening";
  return "late";
}

export function getSessionLabel(now: Date): string {
  // 当前主导 session（粗略）
  const hour = Number(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hour12: false,
    }),
  );
  if (hour >= 8 && hour < 16) return "亚盘";
  if (hour >= 16 && hour < 21) return "欧盘";
  return "美盘";
}

// ---------- 风险事件 ----------

const ALL_RISKS: RiskEvent[] = riskCalendarRaw as RiskEvent[];

export function getTodayRisks(now: Date): RiskEvent[] {
  const today = todayBeijing(now);
  return ALL_RISKS.filter((r) => r.date === today);
}

export function getUpcomingRisks(now: Date, days = 2): RiskEvent[] {
  const today = todayBeijing(now);
  const todayMs = Date.parse(today + "T00:00:00+08:00");
  const cutoff = todayMs + days * 24 * 60 * 60 * 1000;
  return ALL_RISKS.filter((r) => {
    const ms = Date.parse(r.date + "T00:00:00+08:00");
    return ms >= todayMs && ms <= cutoff;
  });
}

function todayBeijing(now: Date): string {
  // YYYY-MM-DD in Asia/Shanghai
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // en-CA 自然返回 YYYY-MM-DD
}

// ---------- 标签派生 ----------

function tickerState(t: CryptoTicker): ObservationState {
  const change = t.priceChangePercent;
  // 振幅
  const amp = ((t.high - t.low) / t.lastPrice) * 100;
  if (amp >= 5) return "high-vol";
  if (Math.abs(change) >= 3) return change > 0 ? "strong" : "weak";
  if (amp <= 1.5) return "low-vol";
  return "neutral";
}

function tickerNote(t: CryptoTicker): string {
  const state = tickerState(t);
  const change = t.priceChangePercent;
  switch (state) {
    case "strong":
      return `强势 +${change.toFixed(1)}%`;
    case "weak":
      return `承压 ${change.toFixed(1)}%`;
    case "high-vol":
      return `高波动 振幅 ${(((t.high - t.low) / t.lastPrice) * 100).toFixed(1)}%`;
    case "low-vol":
      return "低波动 区间收缩";
    case "neutral":
      return change >= 0 ? `中性偏强 +${change.toFixed(1)}%` : `中性偏弱 ${change.toFixed(1)}%`;
    default:
      return "—";
  }
}

function goldState(q: GoldQuote): ObservationState {
  const amp = ((q.high24h - q.low24h) / q.price) * 100;
  if (amp >= 1.5) return "high-vol";
  if (Math.abs(q.changePct) >= 1.0) return q.changePct > 0 ? "strong" : "weak";
  if (amp <= 0.5) return "low-vol";
  return "neutral";
}

function goldNote(q: GoldQuote): string {
  const state = goldState(q);
  const change = q.changePct;
  switch (state) {
    case "strong":
      return `强势 +${change.toFixed(2)}%`;
    case "weak":
      return `承压 ${change.toFixed(2)}%`;
    case "high-vol":
      return `高波动 振幅 ${(((q.high24h - q.low24h) / q.price) * 100).toFixed(1)}%`;
    case "low-vol":
      return "低波动 区间收缩";
    case "neutral":
      return change >= 0 ? `中性偏强 +${change.toFixed(2)}%` : `中性偏弱 ${change.toFixed(2)}%`;
    default:
      return "—";
  }
}

// ---------- 情报快照 ----------

export async function getIntelSnapshot(now = new Date()): Promise<IntelSnapshot> {
  // 三路 fetch 并发；任何一路失败容忍
  const [tickersRes, goldRes] = await Promise.allSettled([
    fetchCryptoTickers(),
    fetchGoldQuote(),
  ]);

  const observations: Observation[] = [];

  if (tickersRes.status === "fulfilled") {
    const btc = tickersRes.value.find((t) => t.symbol === "BTCUSDT");
    const eth = tickersRes.value.find((t) => t.symbol === "ETHUSDT");
    if (btc) observations.push({ label: "BTC", state: tickerState(btc), note: tickerNote(btc) });
    if (eth) observations.push({ label: "ETH", state: tickerState(eth), note: tickerNote(eth) });
  }

  if (goldRes.status === "fulfilled" && goldRes.value) {
    observations.push({
      label: "黄金 XAU/USD",
      state: goldState(goldRes.value),
      note: goldNote(goldRes.value),
    });
  }

  // 外汇：仅取一组代表性的
  try {
    const quotes = await fetchForexQuotes();
    const eurusd = quotes.find((q) => q.pair === "EUR/USD");
    if (eurusd) {
      observations.push({
        label: "EUR/USD",
        state: "neutral",
        note: `${eurusd.price.toFixed(4)}`,
      });
    }
  } catch {}

  // AI 备注（2-3 条）：基于上述 observations 派生
  const aiNotes: string[] = [];
  const session = getSessionLabel(now);
  aiNotes.push(`${session} 流动性活跃中`);

  const highVolList = observations.filter((o) => o.state === "high-vol");
  if (highVolList.length > 0) {
    aiNotes.push(`${highVolList[0].label} 24h 波动率显著放大`);
  }

  const lowVolList = observations.filter((o) => o.state === "low-vol");
  if (lowVolList.length > 0) {
    aiNotes.push(`${lowVolList[0].label} 进入区间收缩，关注突破方向`);
  }

  // 距 24h 高位近的资产
  if (tickersRes.status === "fulfilled") {
    for (const t of tickersRes.value) {
      const distHigh = ((t.high - t.lastPrice) / t.lastPrice) * 100;
      if (distHigh < 0.5 && t.symbol === "BTCUSDT") {
        aiNotes.push("BTC 接近 24h 高位，关注是否扫损");
        break;
      }
    }
  }

  return {
    observations,
    risks: getUpcomingRisks(now, 2),
    aiNotes: aiNotes.slice(0, 3),
  };
}

// ---------- 用户交易洞察（个性化欢迎语用） ----------

export async function getTraderInsight(userId: string): Promise<TraderInsight | null> {
  const trades = await prisma.trade.findMany({
    where: { userId },
    orderBy: { openedAt: "desc" },
    take: 50,
    select: {
      symbol: true,
      direction: true,
      entryPrice: true,
      pnlPct: true,
      status: true,
      setup: true,
      timeframe: true,
    },
  });

  if (trades.length === 0) return null;

  const stats = aggregateStats(
    trades.map((t) => ({
      status: t.status as TradeStatus,
      pnlPct: t.pnlPct,
      setup: t.setup,
      symbol: t.symbol,
    })),
  );

  // ---------- 行为派生字段（topSymbol / topTimeframe / recentLossStreak）----------

  // topSymbol: 已平仓 ≥2 笔（aggregateStats 已按 count 排序）
  let topSymbol: string | undefined;
  if (stats.bySymbol.length > 0 && stats.bySymbol[0].count >= 2) {
    topSymbol = stats.bySymbol[0].symbol;
  }

  // topTimeframe: 全部 trades（含未平仓）≥2 笔
  let topTimeframe: string | undefined;
  const tfMap = new Map<string, number>();
  for (const t of trades) {
    if (t.timeframe) tfMap.set(t.timeframe, (tfMap.get(t.timeframe) ?? 0) + 1);
  }
  if (tfMap.size > 0) {
    const sorted = Array.from(tfMap.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted[0][1] >= 2) topTimeframe = sorted[0][0];
  }

  // recentLossStreak: 从最新已平仓往回数连亏；遇盈利或非 CLOSED 即停（≥2 才返回）
  let lossStreak = 0;
  for (const t of trades) {
    if (t.status !== "CLOSED" || t.pnlPct == null) continue;
    if (t.pnlPct < 0) lossStreak += 1;
    else break;
  }
  const recentLossStreak = lossStreak >= 2 ? lossStreak : undefined;

  // ---------- 不到 3 笔已平仓 → 仅返回基础 + 行为字段（不算 setup 强弱）----------
  if (stats.totalClosed < 3) {
    return {
      totalClosed: stats.totalClosed,
      totalOpen: stats.totalOpen,
      winRatePct: stats.winRate,
      hasOpenPosition: stats.totalOpen > 0,
      topSymbol,
      topTimeframe,
      recentLossStreak,
    };
  }

  const ranked = stats.bySetup.filter((s) => s.count >= 3);
  let bestSetup: string | undefined;
  let weakestSetup: string | undefined;
  if (ranked.length > 0) {
    const best = ranked.reduce((a, b) => (a.winRate > b.winRate ? a : b));
    const worst = ranked.reduce((a, b) => (a.winRate < b.winRate ? a : b));
    bestSetup = best.setup;
    if (worst.setup !== best.setup && worst.winRate < 40) {
      weakestSetup = worst.setup;
    }
  }

  return {
    totalClosed: stats.totalClosed,
    totalOpen: stats.totalOpen,
    winRatePct: stats.winRate,
    bestSetup,
    weakestSetup,
    hasOpenPosition: stats.totalOpen > 0,
    topSymbol,
    topTimeframe,
    recentLossStreak,
  };
}

// ---------- Welcome 文案显示用的小格式器 ----------

/** BTCUSDT → BTC, ETHUSDT → ETH；其他原样（EUR/USD / AAPL / 600519 不动） */
function formatSymbolDisplay(s: string): string {
  if (s.length > 4 && s.toUpperCase().endsWith("USDT")) return s.slice(0, -4);
  return s;
}

/** 4h → 4H, 1d → 1D, weekly → weekly */
function formatTimeframeDisplay(tf: string): string {
  if (/^\d+[hdwm]$/i.test(tf)) return tf.toUpperCase();
  return tf;
}

// ---------- 欢迎语生成 ----------

export type WelcomeContext = {
  now: Date;
  nickname?: string | null;
  insight?: TraderInsight | null;
  risks: RiskEvent[]; // 今天的事件
};

export function buildWelcomeMessage(ctx: WelcomeContext): string {
  const part = getDayPart(ctx.now);
  const session = getSessionLabel(ctx.now);
  const greeting = greetByPart(part, ctx.nickname);

  // 第二句：市场观察（按时间段）
  const market = marketLineByPart(part, session);

  // 第三句：个性化（仅在有真数据时）
  const personal = ctx.insight ? personalLine(ctx.insight) : "";

  // 第四句：风险事件（仅在今天有 high importance 时）
  const highRisk = ctx.risks.find((r) => r.importance === "high");
  const risk = highRisk
    ? `今天关注：${highRisk.name}${highRisk.time ? `（北京 ${highRisk.time}）` : ""}，提前留意波动放大。`
    : "";

  return [greeting, market, personal, risk].filter(Boolean).join(" ");
}

function greetByPart(part: DayPart, nickname?: string | null): string {
  const who = nickname ? `${nickname}` : "你";
  switch (part) {
    case "morning":
      return `早上好，${who}。`;
    case "afternoon":
      return `下午好，${who}。`;
    case "evening":
      return `晚上好，${who}。`;
    case "late":
      return `凌晨好，${who}。`;
  }
}

function marketLineByPart(part: DayPart, session: string): string {
  switch (part) {
    case "morning":
      return `${session}正在展开，早盘流动性偏低，适合先看 4H 结构再决定关注哪些标的。`;
    case "afternoon":
      return `${session}流动性进入活跃期，主要标的可能出现关键结构验证。`;
    case "evening":
      return `${session}波动可能放大，关注事件前后流动性变化。`;
    case "late":
      return `${session}收盘前夕，适合做日内复盘与隔夜结构观察。`;
  }
}

function personalLine(insight: TraderInsight): string {
  // 先组合"主关注"短语（仅在 topSymbol 存在时）
  const focusPhrase = insight.topSymbol
    ? `${formatSymbolDisplay(insight.topSymbol)}${
        insight.topTimeframe ? ` ${formatTimeframeDisplay(insight.topTimeframe)}` : ""
      }`
    : null;

  // < 3 笔已平仓：以持仓为陪练锚点，能带 focusPhrase 就带
  if (insight.totalClosed < 3) {
    if (!insight.hasOpenPosition) return "";
    return focusPhrase
      ? `当前你在 ${focusPhrase} 上有 ${insight.totalOpen} 笔持仓，记得检查关键结构是否仍有效。`
      : `你当前有 ${insight.totalOpen} 笔持仓，记得检查关键结构是否仍有效。`;
  }

  // ≥3 笔：组合"主关注 + 行为倾向（连亏 / 弱势 / 优势）+ 持仓"，最多 2 句以控篇幅
  const parts: string[] = [];

  if (focusPhrase) {
    parts.push(`你最近更关注 ${focusPhrase} 结构`);
  }

  // 行为倾向（优先级：长连亏 > 短连亏 > 弱势 setup > 优势 setup）
  if (insight.recentLossStreak != null && insight.recentLossStreak >= 5) {
    parts.push("最近一段时间表现不太稳定，现阶段也许更适合等待结构确认再参与");
  } else if (insight.recentLossStreak != null && insight.recentLossStreak >= 2) {
    parts.push(
      `最近 ${insight.recentLossStreak} 次表现不太稳定，现阶段也许更适合等待结构确认再参与`,
    );
  } else if (insight.weakestSetup) {
    parts.push(`「${insight.weakestSetup}」过去胜率偏低，遇到时可以多等一步确认`);
  } else if (insight.bestSetup) {
    parts.push(`你的优势是「${insight.bestSetup}」，可优先扫这类形态`);
  }

  // 持仓提醒（仅当上面已有不到 2 句时补）
  if (insight.hasOpenPosition && parts.length < 2) {
    parts.push(`当前 ${insight.totalOpen} 笔持仓，记得复查关键位`);
  }

  return parts.length > 0 ? parts.join("，") + "。" : "";
}

// ---------- 状态条文案（AIPulseStrip 用） ----------

export function buildPulseMessages(snapshot: IntelSnapshot, now = new Date()): string[] {
  const out: string[] = [];
  const session = getSessionLabel(now);
  out.push(`TradePilot 正在监测${session}流动性`);

  for (const o of snapshot.observations) {
    if (o.state === "high-vol") {
      out.push(`检测到 ${o.label} 波动率上升`);
    } else if (o.state === "strong") {
      out.push(`${o.label} 当前结构偏强`);
    } else if (o.state === "weak") {
      out.push(`${o.label} 当前结构承压`);
    } else if (o.state === "low-vol") {
      out.push(`${o.label} 进入区间收缩`);
    }
  }

  const highRisk = snapshot.risks.find((r) => r.importance === "high");
  if (highRisk) {
    out.push(`关注事件：${highRisk.name}`);
  }

  // 至少给 3 条让轮播有意义
  while (out.length < 3) {
    out.push("TradePilot 在线陪你看市场");
  }
  return out;
}

// ---------- 动态建议问题（首页 ChatWindow 空状态） ----------

export type SuggestionItem = {
  /** 显示图标（emoji） */
  icon: string;
  /** 标签文字，如"高影响事件" / "行情分析" */
  tag: string;
  /** 卡片标题（简短） */
  label: string;
  /** 点击后发送给 AI 的完整问题 */
  question: string;
  /** 标签颜色主题：red=风险事件 / green=行情 / blue=复盘 / gray=其他 */
  tagColor: "red" | "green" | "blue" | "gray";
};

/** 把风险事件转成 SuggestionItem */
function riskToSuggestion(r: RiskEvent): SuggestionItem {
  const regionLabel: Record<RiskRegion, string> = {
    US: "🇺🇸",
    EU: "🇪🇺",
    CN: "🇨🇳",
    GLOBAL: "🌐",
  };
  const flag = regionLabel[r.region] ?? "📅";
  const timeStr = r.time ? ` ${r.time}` : "";
  return {
    icon: r.importance === "high" ? "⚠️" : "📅",
    tag: r.importance === "high" ? "高影响事件" : "重要事件",
    label: r.name,
    question: `今天有 "${r.name}"（${flag}${timeStr}）这个重要事件，请分析它对黄金、外汇和加密市场可能产生的影响，以及交易者需要注意什么？`,
    tagColor: r.importance === "high" ? "red" : "gray",
  };
}

const MORNING_BASE: Omit<SuggestionItem, "tag" | "tagColor">[] = [
  { icon: "📈", label: "黄金隔夜结构", question: "帮我分析黄金隔夜的价格结构，当前偏多还是偏空？关键支撑阻力在哪里？" },
  { icon: "₿", label: "BTC H4 方向", question: "BTC 当前 H4 结构倾向偏多还是偏空？关键 OB 和流动性区域在哪？" },
];
const AFTERNOON_BASE: Omit<SuggestionItem, "tag" | "tagColor">[] = [
  { icon: "💱", label: "EUR/USD 结构", question: "EUR/USD 当前结构倾向如何？关键 OB 和流动性区域在哪里？" },
  { icon: "📈", label: "黄金 1H 关键位", question: "黄金 1H 图上当前关键 OB 和流动性区域在哪里？现在适合做多还是做空？" },
];
const EVENING_BASE: Omit<SuggestionItem, "tag" | "tagColor">[] = [
  { icon: "📊", label: "纳指今晚走势", question: "纳指今晚欧美盘可能的波动方向如何？有哪些关键价位需要关注？" },
  { icon: "📈", label: "黄金欧美盘结构", question: "黄金欧美盘衔接结构怎么看？当前偏多还是偏空，关键位置在哪？" },
];
const LATE_BASE: Omit<SuggestionItem, "tag" | "tagColor">[] = [
  { icon: "🔄", label: "复盘今日交易", question: "帮我复盘今天的交易，分析我的入场逻辑、止损设置和仓位管理是否合理。" },
  { icon: "₿", label: "BTC 周线结构", question: "BTC 当前周线结构倾向如何？中期方向偏多还是偏空？" },
];

const POSITION_SUGGESTION: SuggestionItem = {
  icon: "🎯",
  tag: "持仓分析",
  label: "检查我的持仓",
  question: "帮我检查当前持仓的风险：止损是否合理？仓位是否过重？关键结构是否仍然有效？",
  tagColor: "blue",
};

const REVIEW_SUGGESTION: SuggestionItem = {
  icon: "🧠",
  tag: "交易复盘",
  label: "复盘上一笔交易",
  question: "帮我复盘最近一笔交易，分析入场逻辑、执行情况和可以改进的地方。",
  tagColor: "blue",
};

export function getDynamicSuggestions(
  now = new Date(),
  hasOpenPosition = false,
): SuggestionItem[] {
  const part = getDayPart(now);

  // 今日 + 明日风险事件（最多取 2 个高影响，再补 1 个中影响）
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const upcomingRisks = (riskCalendarRaw as RiskEvent[])
    .filter((r) => r.date === todayStr || r.date === tomorrowStr)
    .sort((a, b) => {
      // 高影响优先，今天优先
      if (a.importance !== b.importance) return a.importance === "high" ? -1 : 1;
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return 0;
    })
    .slice(0, 2);

  const riskItems = upcomingRisks.map(riskToSuggestion);

  // 时段基础建议（取 2 条）
  let baseRaw: Omit<SuggestionItem, "tag" | "tagColor">[];
  switch (part) {
    case "morning": baseRaw = MORNING_BASE; break;
    case "afternoon": baseRaw = AFTERNOON_BASE; break;
    case "evening": baseRaw = EVENING_BASE; break;
    case "late": baseRaw = LATE_BASE; break;
  }
  const baseItems: SuggestionItem[] = baseRaw.map((b) => ({
    ...b,
    tag: "行情分析",
    tagColor: "green" as const,
  }));

  // 组合：风险事件优先，补齐到 4 条
  const combined: SuggestionItem[] = [...riskItems, ...baseItems];

  // 第 4 条：有持仓 → 持仓分析，否则 → 复盘
  if (combined.length < 4) {
    combined.push(hasOpenPosition ? POSITION_SUGGESTION : REVIEW_SUGGESTION);
  } else if (hasOpenPosition) {
    combined[3] = POSITION_SUGGESTION;
  } else {
    combined[3] = REVIEW_SUGGESTION;
  }

  return combined.slice(0, 4);
}
