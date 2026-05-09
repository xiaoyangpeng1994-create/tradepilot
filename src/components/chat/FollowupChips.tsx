"use client";

/**
 * AI 回复结尾的"接下来可以问"chips。
 * 内容由 LLM 在回答末尾以 HTML 注释 <!--FOLLOWUPS:a|b|c--> 形式生成，
 * ChatWindow 解析后传入。
 */
export function FollowupChips({
  items,
  onPick,
}: {
  items: string[];
  onPick: (text: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 max-w-[680px] flex flex-wrap items-center gap-2">
      <span className="text-[10px] tracking-widest uppercase text-ink-dim shrink-0">
        接下来
      </span>
      {items.map((t) => (
        <button
          key={t}
          type="button"
          title={t}
          onClick={() => onPick(t)}
          className="text-[12px] px-2.5 py-1 rounded-full border border-white/[0.06] bg-bg-card/60 text-ink-base hover:border-accent-razer/40 hover:text-accent-razer hover:bg-bg-card transition-colors truncate max-w-[180px]"
        >
          {t}
        </button>
      ))}
    </div>
  );
}
