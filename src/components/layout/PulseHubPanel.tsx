export function PulseHubPanel() {
  return (
    <div className="terminal-card p-4 space-y-2 text-[11px]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-[10px] text-ink-muted uppercase tracking-widest">
          <span className="size-1.5 bg-accent-purple rounded-full animate-pulseLine" />
          机构脉冲监控 (LIVE HUB)
        </div>
      </div>
      <Row label="Institutional Net Flow" value="+$2.1B" valueClass="text-accent-neon" />
      <Row label="Current Volatility" value="72.4%" valueClass="text-accent-gold" />
      <Row label="Liquidity Depth" value="STABLE" valueClass="text-accent-info" />
    </div>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

export function AutoPushPanel() {
  return (
    <div className="terminal-card p-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[11px] text-accent-info">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
          <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" />
        </svg>
        加密推送 (AUTO-PUSH)
      </div>
      <span className="text-[10px] text-accent-gold">⚠</span>
    </div>
  );
}
