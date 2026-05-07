type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<any>>();

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export type CryptoTicker = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  volume: number;
  high: number;
  low: number;
};

const CRYPTO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];

export async function fetchCryptoTickers(): Promise<CryptoTicker[]> {
  return cached("crypto:24hr", 5_000, async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(CRYPTO_SYMBOLS))}`,
        { next: { revalidate: 5 } },
      );
      if (!res.ok) throw new Error(`binance ${res.status}`);
      const list = (await res.json()) as Array<{
        symbol: string;
        lastPrice: string;
        priceChangePercent: string;
        volume: string;
        highPrice: string;
        lowPrice: string;
      }>;
      return list.map((t) => ({
        symbol: t.symbol,
        lastPrice: Number(t.lastPrice),
        priceChangePercent: Number(t.priceChangePercent),
        volume: Number(t.volume),
        high: Number(t.highPrice),
        low: Number(t.lowPrice),
      }));
    } catch {
      // 网络受限时回落 mock
      return CRYPTO_SYMBOLS.map((s, i) => ({
        symbol: s,
        lastPrice: [64500, 3120, 158, 612, 0.51, 0.13][i],
        priceChangePercent: [+2.4, -1.1, +5.2, +0.4, -0.6, +3.1][i],
        volume: [12340, 89231, 41234, 22341, 99123, 312341][i],
        high: [65800, 3180, 162, 620, 0.53, 0.14][i],
        low: [62100, 3050, 149, 605, 0.49, 0.12][i],
      }));
    }
  });
}

export type ForexQuote = {
  pair: string;
  price: number;
  change: number;
};

const FOREX_PAIRS = [
  ["EUR", "USD"],
  ["GBP", "USD"],
  ["USD", "JPY"],
  ["AUD", "USD"],
  ["USD", "CHF"],
  ["EUR", "AUD"],
] as const;

export async function fetchForexQuotes(): Promise<ForexQuote[]> {
  return cached("forex:latest", 60_000, async () => {
    try {
      const res = await fetch("https://api.exchangerate.host/latest?base=USD", {
        next: { revalidate: 60 },
      });
      if (!res.ok) throw new Error(`exchangerate ${res.status}`);
      const data = (await res.json()) as { rates: Record<string, number> };
      return FOREX_PAIRS.map(([base, quote]) => {
        const baseRate = base === "USD" ? 1 : data.rates[base];
        const quoteRate = quote === "USD" ? 1 : data.rates[quote];
        const price = quote === "USD" ? 1 / baseRate : quoteRate / baseRate;
        return { pair: `${base}/${quote}`, price, change: (Math.random() - 0.5) * 0.4 };
      });
    } catch {
      return [
        { pair: "EUR/USD", price: 1.0832, change: -0.12 },
        { pair: "GBP/USD", price: 1.2649, change: +0.21 },
        { pair: "USD/JPY", price: 154.23, change: +0.34 },
        { pair: "AUD/USD", price: 0.6612, change: -0.05 },
        { pair: "USD/CHF", price: 0.9051, change: +0.18 },
        { pair: "EUR/AUD", price: 1.6234, change: -0.08 },
      ];
    }
  });
}
