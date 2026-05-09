import { getIntelSnapshot, type Observation } from "@/lib/intel";

/**
 * RSC：3 列市场情报面板（极简版）。
 * 默认由 CollapsibleOnMobile 包裹，折叠显示。
 */
export async function MarketIntelPanel() {
  const snap = await getIntelSnapshot();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
      <Column title="今日市场观察">
        <ul className="space-y-2">
          {snap.observations.length === 0 ? (
            <Empty>实时数据暂不可用</Empty>
          ) : (
            snap.observations.map((o) => <ObsRow key={o.label} obs={o} />)
          )}
        </ul>
      </Column>

      <Column title="今日风险事件">
        <ul className="space-y-2">
          {snap.risks.length === 0 ? (
            <Empty>本日无重要事件</Empty>
          ) : (
            snap.risks.map((r) => (
              <li key={`${r.date}-${r.name}`} className="flex items-start gap-2">
                <span
                  className="mt-1.5 size-1.5 rounded-full shrink-0"
                  style={{ background: r.importance === "high" ? "#f7931a" : "#525252" }}
                />
                <div className="text-[13px] leading-snug" style={{ color: "#d4d4d4" }}>
                  <span style={{ color: "#f5f5f5" }}>{r.name}</span>
                  <span className="ml-2 text-[11px]" style={{ color: "#737373" }}>
                    {r.date.slice(5)}{r.time ? ` · ${r.time}` : ""}
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </Column>

      <Column title="AI 观察">
        <ul className="space-y-2">
          {snap.aiNotes.length === 0 ? (
            <Empty>暂无观察</Empty>
          ) : (
            snap.aiNotes.map((n, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 size-1 rounded-full shrink-0" style={{ background: "#10a37f" }} />
                <span className="text-[13px] leading-snug" style={{ color: "#d4d4d4" }}>{n}</span>
              </li>
            ))
          )}
        </ul>
      </Column>
    </div>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="text-[10px] tracking-wide uppercase mb-3" style={{ color: "#737373" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ObsRow({ obs }: { obs: Observation }) {
  const dotColor =
    obs.state === "strong"
      ? "#10a37f"
      : obs.state === "weak"
        ? "#ef4444"
        : obs.state === "high-vol"
          ? "#f7931a"
          : obs.state === "low-vol"
            ? "#525252"
            : "#525252";
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 size-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
      <div className="flex-1 flex items-baseline justify-between gap-3">
        <span className="text-[13px]" style={{ color: "#f5f5f5" }}>{obs.label}</span>
        <span className="text-[11px]" style={{ color: "#a3a3a3" }}>{obs.note}</span>
      </div>
    </li>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="text-[12px] italic" style={{ color: "#737373" }}>{children}</li>;
}
