export function PageHeader({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div className="px-6 py-4 border-b border-white/[0.04] bg-bg-panel/30 flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <div className="w-0.5 h-4 bg-accent-razer/40 rounded-sm" />
        <h1 className="text-ink-bright text-lg font-semibold tracking-wide">{title}</h1>
        {badge && (
          <span className="text-[10px] tracking-[0.18em] uppercase text-ink-muted border border-white/[0.06] rounded px-1.5 py-0.5">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="text-[10px] tracking-[0.18em] uppercase text-ink-dim">
          {subtitle}
        </div>
      )}
    </div>
  );
}
