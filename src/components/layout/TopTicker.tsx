"use client";
import { useEffect, useState } from "react";
import { AIPulseStrip } from "./AIPulseStrip";

type Ticker = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
};

export function TopTicker({ pulseMessages = [] }: { pulseMessages?: string[] }) {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let abort = false;
    const load = async () => {
      try {
        const [cryptoRes, goldRes] = await Promise.all([
          fetch("/api/market/crypto", { cache: "no-store" }),
          fetch("/api/market/gold", { cache: "no-store" }),
        ]);
        if (!cryptoRes.ok) throw new Error();
        const crypto = (await cryptoRes.json()) as Ticker[];
        const gold = goldRes.ok ? ((await goldRes.json()) as Ticker[]) : [];
        if (!abort) {
          // 黄金放最前显眼：现货 XAU 先看，再 BTC/ETH/...
          setTickers([...gold, ...crypto]);
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
        "XAU --",
        "BTC --",
        "ETH --",
        "正在连接 LIVE FEED...",
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
        {stale ? "FEED_OFFLINE" : "LIVE_FEED"}
      </span>
      <div className="flex whitespace-nowrap py-1.5 animate-marquee flex-1 min-w-0">
        <span className="px-4">{doubled}</span>
        <span className="px-4">{doubled}</span>
      </div>
      <div className="shrink-0 border-l border-bg-edge flex items-center bg-bg-card/40">
        <AIPulseStrip messages={pulseMessages} />
      </div>
    </div>
  );
}

function formatTicker(t: Ticker): string {
  // XAU 显示成 "XAU $2,421" 而不是经过 USDT 替换的 "XAUUSD"
  if (t.symbol === "XAUUSD") {
    const price = t.lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 });
    const sign = t.priceChangePercent >= 0 ? "+" : "";
    return `XAU $${price} ${sign}${t.priceChangePercent.toFixed(2)}%`;
  }
  const symbol = t.symbol.replace("USDT", "");
  const price =
    t.lastPrice >= 100
      ? t.lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })
      : t.lastPrice.toFixed(4);
  const sign = t.priceChangePercent >= 0 ? "+" : "";
  return `${symbol} $${price} ${sign}${t.priceChangePercent.toFixed(2)}%`;
}
