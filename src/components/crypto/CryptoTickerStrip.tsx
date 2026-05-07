"use client";
import { useEffect, useState } from "react";

type Ticker = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  high: number;
  low: number;
  volume: number;
};

export function CryptoTickerStrip() {
  const [data, setData] = useState<Ticker[]>([]);
  useEffect(() => {
    const load = () => fetch("/api/market/crypto").then((r) => r.json()).then(setData).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);
  if (!data.length) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 px-6 py-3 border-b border-bg-edge bg-bg-panel/20">
      {data.map((t) => (
        <div key={t.symbol} className="terminal-card px-3 py-2">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-ink-muted tracking-wide">{t.symbol.replace("USDT", "/USDT")}</span>
            <span
              className={`text-[10px] ${
                t.priceChangePercent >= 0 ? "text-accent-neon" : "text-accent-danger"
              }`}
            >
              {t.priceChangePercent >= 0 ? "+" : ""}
              {t.priceChangePercent.toFixed(2)}%
            </span>
          </div>
          <div className="text-ink-bright text-base mt-0.5">
            {t.lastPrice >= 100 ? t.lastPrice.toLocaleString("en-US", { maximumFractionDigits: 2 }) : t.lastPrice.toFixed(4)}
          </div>
        </div>
      ))}
    </div>
  );
}
