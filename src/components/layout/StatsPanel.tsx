export function StatsPanel({
  winRate = 82.4,
  rr = "1:3.2",
  pipsMtd = 4281,
  rank = "MASTER TRADER",
}: {
  winRate?: number;
  rr?: string;
  pipsMtd?: number;
  rank?: string;
}) {
  return (
    <div className="terminal-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] text-accent-info uppercase tracking-widest">
          <span className="size-1.5 bg-accent-info rounded-full animate-pulseLine" />
          AI 性能实况监测
        </div>
        <BarsMini />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-ink-dim">实时胜率</div>
          <div className="text-accent-neon text-2xl font-light">
            {winRate}
            <span className="text-xs text-ink-muted">%</span>
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-widest text-ink-dim">平均 RR</div>
          <div className="text-accent-info text-2xl font-light">{rr}</div>
        </div>
      </div>
      <div className="h-px bg-bg-edge" />
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-widest text-ink-dim">total pips (mtd)</div>
          <div className="text-ink-bright text-sm">+{pipsMtd.toLocaleString()}</div>
        </div>
        <span className="text-[9px] tracking-widest uppercase rounded-sm bg-accent-neon/15 text-accent-neon px-1.5 py-0.5 border border-accent-neon/30">
          {rank}
        </span>
      </div>
    </div>
  );
}

function BarsMini() {
  const heights = [4, 8, 6, 12, 7, 14, 10, 16, 12];
  return (
    <div className="flex items-end gap-0.5 h-5">
      {heights.map((h, i) => (
        <div key={i} className="w-0.5 bg-accent-neon/70" style={{ height: `${h}px` }} />
      ))}
    </div>
  );
}
