"use client";
import { useRef } from "react";
import { ChatWindow, type ChatWindowHandle } from "@/components/chat/ChatWindow";

export type Signal = {
  id: string;
  name: string;
  handle: string;
  avatarLetter: string;
  avatarBg: string;
  timeAgo: string;
  content: string;
  asset: string;
  comments: number;
  retweets: number;
};

export function TwitterClient({ signals }: { signals: Signal[] }) {
  const chatRef = useRef<ChatWindowHandle>(null);

  function deepDive(s: Signal) {
    const prompt = `请基于 SMC/ICT 框架深度剖析这条来自 @${s.handle} (${s.name}) 的实时信号，重点判断入场逻辑是否成立、风险点在哪、合理止损/止盈位置：

「${s.content}」

涉及资产：${s.asset}`;
    chatRef.current?.ask(prompt);
    document.getElementById("twitter-chat")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
        <AlphaBanner />
        {signals.map((s) => (
          <SignalCard key={s.id} signal={s} onDeepDive={() => deepDive(s)} />
        ))}
      </div>

      <div id="twitter-chat" className="h-[40vh] min-h-[280px] border-t border-bg-edge">
        <ChatWindow
          ref={chatRef}
          channel="twitter"
          intro="我是彭哥 AI 信号分析助手。点上方任意一条推文的「Gemini 深剖」按钮，我会基于 SMC/ICT 框架立即拆解；也可以直接在下方提问，比如『这一单入场逻辑可靠吗？』。"
          placeholder="问问 AI：这一单入场逻辑可靠吗？"
        />
      </div>
    </>
  );
}

function AlphaBanner() {
  return (
    <div className="terminal-card border-accent-info/30 bg-gradient-to-r from-accent-info/15 via-accent-info/5 to-transparent p-5 flex items-center gap-4">
      <div className="size-12 shrink-0 rounded-md bg-accent-info/20 border border-accent-info/40 grid place-items-center">
        <TwitterIcon />
      </div>
      <div className="flex-1">
        <div className="text-accent-info text-sm font-bold tracking-wide">
          全球 Alpha 实时对齐
        </div>
        <div className="text-[11px] text-ink-muted leading-relaxed mt-1">
          这里汇集了顶尖选手的实时信号。对某位大神的仓位有疑问？直接在下方对话框问我，或者点击信号下方的{" "}
          <span className="text-accent-info">「Gemini 深剖」</span>
          。我会利用顶级大语言模型即时为你拆解！
        </div>
      </div>
    </div>
  );
}

function SignalCard({ signal, onDeepDive }: { signal: Signal; onDeepDive: () => void }) {
  return (
    <div className="terminal-card p-5 hover:border-accent-info/30 transition-colors">
      <div className="flex items-start gap-3">
        <div
          className={`size-10 shrink-0 rounded-md grid place-items-center font-bold text-sm ${signal.avatarBg}`}
        >
          {signal.avatarLetter}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-ink-bright text-sm font-bold">{signal.name}</span>
            <span className="text-[11px] text-ink-dim italic">@{signal.handle}</span>
            <span className="ml-auto text-[10px] text-ink-dim">{signal.timeAgo}</span>
          </div>

          <p className="text-sm text-ink-base mt-2 leading-relaxed whitespace-pre-wrap">
            {signal.content}
          </p>

          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={onDeepDive}
                className="btn-primary text-xs gap-1.5 hover:bg-accent-info/30"
              >
                <SparkIcon /> Gemini 深剖
              </button>
              <span className="text-[11px] text-ink-muted flex items-center gap-1">
                <CommentIcon /> {signal.comments}
              </span>
              <span className="text-[11px] text-ink-muted flex items-center gap-1">
                <RetweetIcon /> {signal.retweets}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] tracking-widest text-accent-gold border border-accent-gold/40 bg-accent-gold/10 rounded-sm px-2 py-0.5">
                {signal.asset}
              </span>
              <a
                href={`https://x.com/${signal.handle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink-dim hover:text-ink-base"
                title="跳转 X (推特) 主页"
              >
                <ExternalIcon />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-5 text-accent-info" fill="currentColor">
      <path d="M14 4.4q-.75.3-1.6.5.6-.3 1-1-.7.4-1.5.5C11 3.7 10 3.5 9 4q-1.5.7-1.5 2.4v.4Q4.5 6.5 2 4q-.5 1-.2 2t1.3 1.7q-.6 0-1-.3.1 1.3 2 2-.6.2-1.1 0 .5 1.3 2 1.5-.8.6-1.8.7-.6.1-1.2 0Q3.4 12.4 6 12.4q4 .1 6.4-3 1.5-2 1.4-4 .6-.4 1.2-1z" />
    </svg>
  );
}
function SparkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="currentColor">
      <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H6l-3 3v-3H3a1 1 0 01-1-1V4z" />
    </svg>
  );
}
function RetweetIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 6l3-3 3 3M5 3v8h6M14 10l-3 3-3-3" />
    </svg>
  );
}
function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 2h5v5M14 2L7 9M11 9v4a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1h4" />
    </svg>
  );
}
