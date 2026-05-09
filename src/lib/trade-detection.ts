/**
 * 启发式检测：用户消息里是否提到了一笔交易（开仓 / 平仓）。
 *
 * 不依赖 LLM——纯正则 + 关键词匹配，零延迟、零额外成本。
 * 故意保守：宁可漏报也不误报。漏报用户去 /journal 手动记，误报会让用户烦。
 */

export type DetectedTrade =
  | { intent: "OPEN"; symbol: string; direction: "LONG" | "SHORT"; entryPrice: number }
  | { intent: "CLOSE"; symbol: string; exitPrice: number }
  | {
      intent: "ROUND_TRIP";
      symbol: string;
      direction: "LONG" | "SHORT";
      entryPrice: number;
      exitPrice: number;
      pnlPct: number;
    };

// 平仓词（必须强过去时/完成时；"止损/止盈"单独出现是计划，"止损了/止盈了"才是已触发）
const CLOSE_TOKENS = [
  "平了", "平仓", "平掉", "已平", "已经平",
  "止损了", "止盈了", "触及止损", "触及止盈",
  "出了", "出来了", "跑了", "落袋", "离场", "出仓",
  "卖飞", "卖飞了",
  "closed", "exited",
];

// 多/空方向词（仅用于开仓识别）
const LONG_TOKENS = ["做多", "多单", "开多", "做多于", "做多在", "long了", "long仓"];
const SHORT_TOKENS = ["做空", "空单", "开空", "做空于", "做空在", "short了", "short仓"];

// 标的关键词 → Binance USDT 永续 symbol 映射
const SYMBOL_MAP: Array<{ keys: string[]; symbol: string }> = [
  { keys: ["btc", "比特币", "比特"], symbol: "BTCUSDT" },
  { keys: ["eth", "以太坊", "以太"], symbol: "ETHUSDT" },
  { keys: ["sol", "索拉纳", "solana"], symbol: "SOLUSDT" },
  { keys: ["bnb", "币安币"], symbol: "BNBUSDT" },
  { keys: ["xrp", "瑞波"], symbol: "XRPUSDT" },
  { keys: ["doge", "狗狗", "狗狗币"], symbol: "DOGEUSDT" },
];

function findSymbol(lower: string): string | null {
  for (const m of SYMBOL_MAP) {
    if (m.keys.some((k) => lower.includes(k))) return m.symbol;
  }
  return null;
}

/**
 * 从文本中提取看起来像价格的数字。优先匹配方向/位置词后面紧跟的数字；
 * fallback 找文中第一个 3-7 位数字。支持 80,500 / 80500 / 80.5K / 80500U 等写法。
 */
function extractPrice(text: string): number | null {
  const contextual = text.match(
    /(?:[@＠]|做多|做空|多单|空单|开多|开空|入场|价格|价位|于|在|平了|平仓|止损了|止盈了|long|short)[\s　:：]*([0-9][\d,]*(?:\.\d+)?)\s*([KkMm万]?)/i,
  );
  if (contextual) {
    const num = Number(contextual[1].replace(/,/g, ""));
    const unit = contextual[2].toLowerCase();
    if (unit === "k") return num * 1000;
    if (unit === "m") return num * 1_000_000;
    if (contextual[2] === "万") return num * 10_000;
    return Number.isFinite(num) ? num : null;
  }

  const fallback = text.match(/(?:^|[^\d])(\d{3,7}(?:\.\d{1,4})?)(?:[^\d]|$)/);
  if (fallback) {
    const num = Number(fallback[1]);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

function isPlausiblePrice(p: number | null): p is number {
  return p != null && Number.isFinite(p) && p > 0.0001 && p < 1_000_000;
}

export function detectTradeMention(text: string): DetectedTrade | null {
  const lower = text.toLowerCase();
  const symbol = findSymbol(lower);
  if (!symbol) return null;

  // 优先尝试 ROUND_TRIP：一句话内同时含方向 + 平仓词 + 至少两个价格
  const roundTrip = tryDetectRoundTrip(text, lower, symbol);
  if (roundTrip) return roundTrip;

  const price = extractPrice(text);
  if (!isPlausiblePrice(price)) return null;

  // 平仓优先：含强过去时关键词 → CLOSE
  const closeHit = CLOSE_TOKENS.some((t) => lower.includes(t.toLowerCase()));
  if (closeHit) {
    return { intent: "CLOSE", symbol, exitPrice: price };
  }

  // 否则尝试开仓
  let direction: "LONG" | "SHORT" | null = null;
  if (LONG_TOKENS.some((t) => lower.includes(t.toLowerCase()))) direction = "LONG";
  else if (SHORT_TOKENS.some((t) => lower.includes(t.toLowerCase()))) direction = "SHORT";
  if (!direction) return null;

  return { intent: "OPEN", symbol, direction, entryPrice: price };
}

/**
 * 尝试从一句话里同时识别 entry + exit（用户一句话讲完一笔完整交易）。
 * 命中条件：
 * - 含方向词（做多 / 做空 / long / short）
 * - 含平仓词（出了 / 平了 / 止盈了 / 落袋 / 离场 / 出仓）
 * - 文本里至少有两个看起来像价格的数字（≥3 位整数）
 *
 * 第一价 = entry，第二价 = exit（自然中文叙述顺序：先入场后离场）。
 * 严格过滤：两价相等不算；任一价不在合理区间不算。
 */
function tryDetectRoundTrip(
  text: string,
  lower: string,
  symbol: string,
): DetectedTrade | null {
  let direction: "LONG" | "SHORT" | null = null;
  if (LONG_TOKENS.some((t) => lower.includes(t.toLowerCase()))) direction = "LONG";
  else if (SHORT_TOKENS.some((t) => lower.includes(t.toLowerCase()))) direction = "SHORT";
  if (!direction) return null;

  const hasCloseHint = CLOSE_TOKENS.some((t) => lower.includes(t.toLowerCase()));
  if (!hasCloseHint) return null;

  // 提取所有"看起来像价格"的数字（≥3 位整数 + 可选小数）
  // 否定后顾确保不切分小数中段：12.345 视为一个整体
  const matches = [...text.matchAll(/(?<![.\d])(\d{3,7}(?:\.\d{1,4})?)(?!\d)/g)];
  const prices = matches
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0.0001 && n < 1_000_000);

  if (prices.length < 2) return null;

  const entryPrice = prices[0];
  const exitPrice = prices[1];
  if (entryPrice === exitPrice) return null;

  const rawPnl = ((exitPrice - entryPrice) / entryPrice) * 100;
  const pnlPct = direction === "LONG" ? rawPnl : -rawPnl;

  return {
    intent: "ROUND_TRIP",
    symbol,
    direction,
    entryPrice,
    exitPrice,
    pnlPct: Number(pnlPct.toFixed(2)),
  };
}
