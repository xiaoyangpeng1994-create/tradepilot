import { cached } from "./market";
import type { Candle, Interval } from "./binance";
import { fetchKlines } from "./binance";

/**
 * 黄金现货数据源 — 双源冗余，硬核版。
 *
 * 主源：Yahoo Finance `GC=F`（COMEX 黄金主力期货，与现货差价 <0.3%；XAUUSD=X 已被 Yahoo 下架，2026 起永远 404）
 * 备源：Binance `PAXGUSDT`（PAX Gold 1:1 实物黄金背书代币，与现货差价 <0.3%，复用现有 Binance 客户端）
 *
 * 设计原则（交易场景严谨性）：
 * 1. 失败时返回 null / 空数组，**绝不返回 mock 死值**（用户引用假数字会做错决策）
 * 2. 价格合理性校验（1500 ≤ price ≤ 6000 USD/oz，2026 现货合理范围），脏数据走下个源
 * 3. 4H K 线按 UTC 0/4/8/12/16/20 边界对齐聚合，跟主流交易所一致
 * 4. 数据带 source + fetchedAt 时间戳，AI 上下文里能看到"几秒前 / 来自哪个源"
 * 5. cache 仅缓存成功结果（fetcher 抛错不进 cache，下次重试）
 */

const YAHOO_SYMBOL = "GC=F";
const YAHOO_BASE = `https://query1.finance.yahoo.com/v8/finance/chart/${YAHOO_SYMBOL}`;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const PAXG_SYMBOL = "PAXGUSDT";

const VALID_PRICE_MIN = 1500;
const VALID_PRICE_MAX = 6000;

export type GoldSource = "yahoo-futures" | "binance-paxg";

export const GOLD_SOURCE_LABELS: Record<GoldSource, string> = {
  "yahoo-futures": "Yahoo COMEX 黄金期货 (GC=F)",
  "binance-paxg": "Binance PAXG/USDT (1:1 物金代币)",
};

export type GoldQuote = {
  price: number;
  change: number;
  changePct: number;
  high24h: number;
  low24h: number;
  source: GoldSource;
  fetchedAt: number;
};

function isValidGoldPrice(p: number): boolean {
  return Number.isFinite(p) && p >= VALID_PRICE_MIN && p <= VALID_PRICE_MAX;
}

// ---------- Quote ----------

type YahooMeta = {
  regularMarketPrice: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
};
type YahooChart = {
  chart: {
    result?: Array<{
      meta: YahooMeta;
      timestamp?: number[];
      indicators: {
        quote: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
  };
};

async function fetchYahooQuote(): Promise<GoldQuote | null> {
  try {
    const res = await fetch(`${YAHOO_BASE}?interval=1d&range=2d`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as YahooChart;
    const r = json.chart.result?.[0];
    if (!r) return null;
    const price = r.meta.regularMarketPrice;
    const prev = r.meta.previousClose ?? r.meta.chartPreviousClose ?? price;
    if (!isValidGoldPrice(price) || !isValidGoldPrice(prev)) return null;
    const change = price - prev;
    const changePct = prev > 0 ? (change / prev) * 100 : 0;
    const high24h = r.meta.regularMarketDayHigh ?? Math.max(price, prev);
    const low24h = r.meta.regularMarketDayLow ?? Math.min(price, prev);
    return {
      price,
      change,
      changePct,
      high24h,
      low24h,
      source: "yahoo-futures",
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

async function fetchPaxgQuote(): Promise<GoldQuote | null> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${PAXG_SYMBOL}`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    const t = (await res.json()) as {
      lastPrice: string;
      priceChangePercent: string;
      highPrice: string;
      lowPrice: string;
      prevClosePrice: string;
    };
    const price = Number(t.lastPrice);
    const prev = Number(t.prevClosePrice);
    if (!isValidGoldPrice(price) || !isValidGoldPrice(prev)) return null;
    return {
      price,
      change: price - prev,
      changePct: Number(t.priceChangePercent),
      high24h: Number(t.highPrice),
      low24h: Number(t.lowPrice),
      source: "binance-paxg",
      fetchedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * 主源失败时自动 fallback 到 Binance PAXG。
 * 两源都挂返 null，上游决定如何降级（不要假装有数据）。
 */
export async function fetchGoldQuote(): Promise<GoldQuote | null> {
  try {
    return await cached("gold:quote", 30_000, async () => {
      const r = (await fetchYahooQuote()) ?? (await fetchPaxgQuote());
      if (!r) throw new Error("ALL_GOLD_QUOTE_SOURCES_FAILED");
      return r;
    });
  } catch {
    return null;
  }
}

// ---------- K-line ----------

const INTERVAL_NATIVE: Partial<Record<Interval, string>> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "1h",
  "1d": "1d",
};

const RANGE_MAP: Partial<Record<Interval, string>> = {
  "1m": "5d",
  "5m": "1mo",
  "15m": "1mo",
  "1h": "3mo",
  "1d": "2y",
};

/**
 * UTC 4H 边界对齐聚合（每根 4H K 线起点 UTC 小时数 ∈ {0,4,8,12,16,20}）。
 * 不齐桶（< 4 根）丢弃，避免给 AI 一根残缺的 4H 影响 OB / FVG 识别。
 */
function aggregateToUtc4H(hourly: Candle[]): Candle[] {
  const buckets = new Map<number, Candle[]>();
  for (const c of hourly) {
    const utcHour = Math.floor(c.openTime / 3_600_000);
    const bucketKey = Math.floor(utcHour / 4) * 4; // 桶起始 UTC 小时数
    const arr = buckets.get(bucketKey) ?? [];
    arr.push(c);
    buckets.set(bucketKey, arr);
  }
  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);
  const out: Candle[] = [];
  for (const k of sortedKeys) {
    const slice = buckets.get(k)!;
    if (slice.length < 4) continue;
    slice.sort((a, b) => a.openTime - b.openTime);
    out.push({
      openTime: slice[0].openTime,
      closeTime: slice[slice.length - 1].closeTime,
      open: slice[0].open,
      high: Math.max(...slice.map((c) => c.high)),
      low: Math.min(...slice.map((c) => c.low)),
      close: slice[slice.length - 1].close,
      volume: slice.reduce((s, c) => s + c.volume, 0),
    });
  }
  return out;
}

async function fetchYahooKlinesRaw(interval: Interval, limit: number): Promise<Candle[]> {
  const yi = INTERVAL_NATIVE[interval];
  if (!yi) return [];
  const ttl = interval === "1m" || interval === "5m" ? 10_000 : 60_000;
  try {
    return await cached(`gold:yahoo:klines:${interval}:${limit}`, ttl, async () => {
      const range = RANGE_MAP[interval] ?? "3mo";
      const res = await fetch(`${YAHOO_BASE}?interval=${yi}&range=${range}`, {
        headers: { "User-Agent": UA },
        next: { revalidate: 60 },
      });
      if (!res.ok) throw new Error(`yahoo klines ${res.status}`);
      const json = (await res.json()) as YahooChart;
      const r = json.chart.result?.[0];
      if (!r || !r.timestamp || !r.indicators?.quote?.[0]) {
        throw new Error("yahoo klines empty");
      }
      const ts = r.timestamp;
      const q = r.indicators.quote[0];
      const out: Candle[] = [];
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i];
        const h = q.high?.[i];
        const l = q.low?.[i];
        const c = q.close?.[i];
        if (o == null || h == null || l == null || c == null) continue;
        if (!isValidGoldPrice(o) || !isValidGoldPrice(c)) continue; // 脏数据丢
        out.push({
          openTime: ts[i] * 1000,
          closeTime: ts[i] * 1000,
          open: o,
          high: h,
          low: l,
          close: c,
          volume: q.volume?.[i] ?? 0,
        });
      }
      if (out.length < 20) throw new Error("yahoo klines insufficient");
      return out.slice(-limit);
    });
  } catch {
    return [];
  }
}

async function fetchPaxgKlinesRaw(interval: Interval, limit: number): Promise<Candle[]> {
  // PAXG/USDT 1:1 实物黄金代币，复用 Binance K 线接口
  const candles = await fetchKlines(PAXG_SYMBOL, interval, limit);
  // 价格合理性校验：脏数据丢
  return candles.filter((c) => isValidGoldPrice(c.close) && isValidGoldPrice(c.open));
}

export async function fetchGoldKlines(
  interval: Interval = "4h",
  limit = 200,
): Promise<Candle[]> {
  // 4h: 1H ×4 UTC 对齐聚合（多取一些容纳对齐损失）
  if (interval === "4h") {
    const hourly = await fetchGoldKlines("1h", limit * 4 + 8);
    return aggregateToUtc4H(hourly).slice(-limit);
  }

  // 主源 Yahoo（仅原生支持的 interval）
  if (INTERVAL_NATIVE[interval]) {
    const yk = await fetchYahooKlinesRaw(interval, limit);
    if (yk.length >= 20) return yk;
  }

  // 备源 Binance PAXG
  return fetchPaxgKlinesRaw(interval, limit);
}
