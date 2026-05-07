const TICKER_ITEMS = [
  "CENTRAL_BANK: A-SHARE LIQUIDITY INJECTION",
  "NORTHBOUND_FLOW: +4.2B CNY INTO HK/SH/SZ",
  "JPMORGAN_CHASE: SOLD 500M EURUSD @ 1.0834",
  "GOLDMAN_SACHS: BOUGHT 1.2B BTC @ 64500",
  "HSBC: SHORT 400M EURGBP @ 1.0950",
  "BARCLAYS: ACCUMULATION DETECTED NAS100",
  "DEUTSCHE_BANK: CLOSED LONG XAUUSD @ 2412",
  "BLACKROCK: ETF INFLOW +890M DAILY",
  "MORGAN_STANLEY: BTC TARGET REVISED → 88K",
  "CITADEL: HFT VOLUME SURGE ON SPX",
];

export function TopTicker() {
  const string = TICKER_ITEMS.join("  •  ") + "  •  ";
  const doubled = string + string;
  return (
    <div className="border-b border-bg-edge bg-bg-panel/60 overflow-hidden text-[10px] tracking-widest uppercase text-ink-dim flex items-stretch pl-12 md:pl-0">
      <span className="shrink-0 px-3 py-1.5 text-accent-razer border-r border-bg-edge bg-bg-card/60 flex items-center gap-1.5">
        <span className="size-1.5 bg-accent-razer rounded-full animate-pulseLine" />
        DEMO_FEED
      </span>
      <div className="flex whitespace-nowrap py-1.5 animate-marquee flex-1 min-w-0">
        <span className="px-4">{doubled}</span>
        <span className="px-4">{doubled}</span>
      </div>
    </div>
  );
}
