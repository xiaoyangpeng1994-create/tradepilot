import Link from "next/link";

export type ChannelLandingProps = {
  title: string;
  subtitle: string;
  description: string;
  samplePrompts: string[];
};

export function ChannelLanding({
  title,
  subtitle,
  description,
  samplePrompts,
}: ChannelLandingProps) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="space-y-3">
          <div className="text-[10px] tracking-widest uppercase text-accent-razer">
            {subtitle}
          </div>
          <h1 className="text-3xl font-bold text-ink-bright tracking-wide">
            {title}
          </h1>
          <p className="text-sm text-ink-muted leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>

        <div className="space-y-3">
          <div className="text-[10px] tracking-widest uppercase text-ink-dim">
            💡 立即试问
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {samplePrompts.map((p) => (
              <Link
                key={p}
                href={`/?prompt=${encodeURIComponent(p)}`}
                className="terminal-card p-4 text-sm text-ink-base hover:border-accent-razer/50 hover:text-ink-bright transition-colors"
              >
                {p}
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-4 flex items-center gap-3">
          <Link href="/" className="btn-primary">
            打开主对话 →
          </Link>
          <span className="text-[11px] text-ink-dim">
            或直接问 AI，会自动识别你说的市场
          </span>
        </div>
      </div>
    </div>
  );
}
