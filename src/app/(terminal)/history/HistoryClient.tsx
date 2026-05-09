"use client";
import Link from "next/link";

type Row = {
  id: string;
  channel: string;
  firstMessage: string;
  messageCount: number;
  updatedAt: string;
};

const CHANNEL_LABELS: Record<string, string> = {
  general: "主对话",
  forex: "外汇",
  gold: "黄金",
  crypto: "加密",
  us: "美股",
  "a-shares": "A 股",
  academy: "学院",
  twitter: "X 信号",
};

export function HistoryClient({ rows }: { rows: Row[] }) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-bright tracking-wide">
            历史会话
          </h1>
          <p className="text-sm text-ink-muted mt-1">
            最近 50 个会话，点击恢复继续。
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="terminal-card p-10 text-center text-ink-muted">
            还没有历史会话。从主对话开始问 AI 吧。
            <div className="mt-4">
              <Link href="/" className="btn-primary">
                开始新对话 →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/?session=${encodeURIComponent(r.id)}&channel=${encodeURIComponent(r.channel)}`}
                className="terminal-card p-4 block hover:border-accent-razer/50 hover:bg-bg-card/50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] tracking-widest uppercase text-accent-razer">
                    {CHANNEL_LABELS[r.channel] || r.channel}
                  </span>
                  <span className="text-[10px] text-ink-dim">
                    {new Date(r.updatedAt).toLocaleString("zh-CN", {
                      hour12: false,
                    })}
                  </span>
                </div>
                <div className="text-sm text-ink-base mt-2 line-clamp-2">
                  {r.firstMessage}
                </div>
                <div className="text-[10px] text-ink-muted mt-2">
                  {r.messageCount} 条消息
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
