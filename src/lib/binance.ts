import { cached } from "./market";

export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
};

export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

/**
 * 拉 Binance 现货 K 线。limit 上限 1000，默认 200 根 4H = 33 天历史。
 * 60s 缓存（4H K 线 1 分钟内不会变，1m K 线本来就要走更短缓存）。
 */
export async function fetchKlines(
  symbol: string,
  interval: Interval = "4h",
  limit = 200,
): Promise<Candle[]> {
  const ttl = interval === "1m" || interval === "5m" ? 10_000 : 60_000;
  return cached(`klines:${symbol}:${interval}:${limit}`, ttl, async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        { next: { revalidate: 60 } },
      );
      if (!res.ok) throw new Error(`binance klines ${res.status}`);
      const raw = (await res.json()) as unknown[][];
      return raw.map((k) => ({
        openTime: Number(k[0]),
        open: Number(k[1]),
        high: Number(k[2]),
        low: Number(k[3]),
        close: Number(k[4]),
        volume: Number(k[5]),
        closeTime: Number(k[6]),
      })) as Candle[];
    } catch {
      return [];
    }
  });
}

const SYMBOL_PATTERNS: Array<{ keys: string[]; symbol: string }> = [
  { keys: ["btc", "比特币", "比特"], symbol: "BTCUSDT" },
  { keys: ["eth", "以太坊", "以太"], symbol: "ETHUSDT" },
  { keys: ["sol", "索拉纳", "solana"], symbol: "SOLUSDT" },
  { keys: ["bnb", "币安币"], symbol: "BNBUSDT" },
  { keys: ["xrp", "瑞波"], symbol: "XRPUSDT" },
  { keys: ["doge", "狗狗", "狗狗币"], symbol: "DOGEUSDT" },
];

/**
 * 从用户消息里识别想问的币种。无匹配回落 BTC。
 * 简单关键词匹配——大小写不敏感，命中第一个就返回。
 */
export function detectCryptoSymbol(message: string): string {
  const lower = message.toLowerCase();
  for (const p of SYMBOL_PATTERNS) {
    if (p.keys.some((k) => lower.includes(k))) return p.symbol;
  }
  return "BTCUSDT";
}

/**
 * 不同交易风格关注的 K 线周期。
 * - INTRADAY 日内：15m + 1H（精确入场）
 * - SWING 短线：1H + 4H（多周期共振）
 * - POSITION 长线：4H + Daily（趋势 + 宏观）
 * - LEARNING 学习：1H + 4H（与 SWING 一致，循序渐进）
 */
export const STYLE_INTERVALS: Record<string, [Interval, Interval]> = {
  INTRADAY: ["15m", "1h"],
  SWING: ["1h", "4h"],
  POSITION: ["4h", "1d"],
  LEARNING: ["1h", "4h"],
};
