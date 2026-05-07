"use client";
import { useEffect, useState } from "react";

type Ticker = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
};

export function TopTicker() {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let abort = false;
    const load = async () => {
      try {
        const res = await fetch("/api/market/crypto", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = (await res.json()) as Ticker[];
        if (!abort) {
          setTickers(data);
          setStale(false);
        }
      } catch {
        if (!abort) setStale(true);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      abort = true;
      clearInterval(t);
    };
  }, []);

  const items = tickers.length
    ? tickers.map(formatTicker)
    : [
        "BTC --",
        "ETH --",
        "SOL --",
        "正在连接 BINANCE LIVE FEED...",
      ];

  const string = items.join("    •    ") + "    •    ";
  const doubled = string + string;

  return (
    <div className="border-b border-bg-edge bg-bg-panel/60 overflow-hidden text-[10px] tracking-widest uppercase text-ink-dim flex items-stretch pl-12 md:pl-0">
      <span
        className={`shrink-0 px-3 py-1.5 border-r border-bg-edge bg-bg-card/60 flex items-center gap-1.5 ${
          stale ? "text-accent-gold" : "text-accent-razer"
        }`}
      >
        <span
          className={`size-1.5 rounded-full animate-pulseLine ${
            stale ? "bg-accent-gold" : "bg-accent-razer"
          }`}
        />
        {stale ? "FEED_OFFLINE" : "BINANCE_LIVE"}
      </span>
      <div className="flex whitespace-nowrap py-1.5 animate-marquee flex-1 min-w-0">
        <span className="px-4">{doubled}</span>
        <span className="px-4">{doubled}</span>
      </div>
    </div>
  );
}

function formatTicker(t: Ticker): string {
  const symbol = t.symbol.replace("USDT", "");
  const price =
    t.lastPrice >= 100
      ? t.lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : t.lastPrice.toFixed(4);
  const sign = t.priceChangePercent >= 0 ? "+" : "";
  return `${symbol} $${price} ${sign}${t.priceChangePercent.toFixed(2)}%`;
}
