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
    <div className="px-6 py-4 border-b border-bg-edge bg-bg-panel/30 flex items-center justify-between">
      <div className="flex items-baseline gap-3">
        <div className="w-1 h-5 bg-accent-info rounded-sm" />
        <h1 className="text-ink-bright text-lg font-bold tracking-wide">{title}</h1>
        {badge && (
          <span className="text-[10px] tracking-widest uppercase text-accent-info border border-accent-info/40 rounded-sm px-1.5 py-0.5">
            {badge}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="text-[10px] tracking-widest uppercase text-ink-dim">
          • {subtitle}
        </div>
      )}
    </div>
  );
}
