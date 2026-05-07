"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

const ANON_LIMIT = 5;
const ANON_KEY = "anon_chat_count";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageData?: string;
  ts: string;
  meta?: { ptsCost?: number; ptsBalance?: number; isVip?: boolean; insufficient?: boolean };
};

export type ChatWindowHandle = {
  ask: (text: string) => void;
};

export const ChatWindow = forwardRef<ChatWindowHandle, {
  channel: string;
  intro?: string;
  placeholder?: string;
  /** 留空状态下显示的快捷示例问题 */
  suggestions?: string[];
}>(function ChatWindow(
  {
    channel,
    intro,
    placeholder = "输入行情代码或与彭哥对话...",
    suggestions,
  },
  ref,
) {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    intro
      ? [
          {
            id: "intro",
            role: "assistant",
            content: intro,
            ts: nowTs(),
          },
        ]
      : [],
  );
  const [pending, setPending] = useState(false);
  const [registerWall, setRegisterWall] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isEmptyState =
    messages.length === 0 ||
    (messages.length === 1 && messages[0].id === "intro");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string, imageBase64?: string) {
    // 匿名访问限制
    if (!isLoggedIn && status !== "loading") {
      const used = Number(localStorage.getItem(ANON_KEY) || "0");
      if (used >= ANON_LIMIT) {
        setRegisterWall(true);
        return;
      }
      localStorage.setItem(ANON_KEY, String(used + 1));
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      imageData: imageBase64,
      ts: nowTs(),
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      ts: nowTs(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, message: text, image: imageBase64 || null }),
      });

      // 算力不足: 替换 assistant 消息为充值 CTA
      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  role: "system" as const,
                  content: "",
                  meta: { insufficient: true, ptsBalance: data.have, ptsCost: data.needed },
                }
              : m,
          ),
        );
        return;
      }

      if (!res.ok || !res.body) throw new Error("bad response");

      const cost = Number(res.headers.get("X-Pts-Cost") || "0");
      const balanceHeader = res.headers.get("X-Pts-Balance");
      const balance = balanceHeader != null ? Number(balanceHeader) : null;
      const isVip = res.headers.get("X-Pts-Vip") === "true";

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)),
        );
      }
      // 流完后写入 meta
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                meta: {
                  ptsCost: cost,
                  ptsBalance: balance ?? undefined,
                  isVip,
                },
              }
            : m,
        ),
      );
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: "[网络错误，请稍后重试]" } : m,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  useImperativeHandle(
    ref,
    () => ({
      ask: (text: string) => {
        if (pending) return;
        send(text);
      },
    }),
    [pending],
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
        {messages.map((m) =>
          m.role === "system" && m.meta?.insufficient ? (
            <InsufficientPtsCard key={m.id} balance={m.meta.ptsBalance ?? 0} needed={m.meta.ptsCost ?? 1} />
          ) : (
            <ChatBubble key={m.id} message={m} isLoggedIn={isLoggedIn} />
          ),
        )}
        {pending && <TypingDots />}
        {isEmptyState && suggestions && suggestions.length > 0 && (
          <SuggestionCards suggestions={suggestions} onPick={(s) => send(s)} />
        )}
      </div>
      <ChatInput onSend={send} disabled={pending} placeholder={placeholder} />
      {registerWall && (
        <RegisterWall
          onClose={() => setRegisterWall(false)}
          callbackUrl={typeof window !== "undefined" ? window.location.pathname : "/forex"}
        />
      )}
    </div>
  );
});

function ChatBubble({ message, isLoggedIn }: { message: ChatMessage; isLoggedIn: boolean }) {
  if (message.role === "assistant") {
    const isIntro = message.id === "intro";
    return (
      <div>
        <div className="text-[10px] tracking-widest text-ink-dim mb-1.5">
          PENG_GE_AI_ENGINE <span className="ml-2 text-accent-razer">{message.ts}</span>
        </div>
        <div className="terminal-card border-bg-edge p-4 max-w-[680px] text-sm text-ink-base whitespace-pre-wrap leading-relaxed">
          {message.content || <span className="text-ink-dim animate-blink">▍</span>}
        </div>
        {!isIntro && message.content && (
          <div className="text-[10px] text-ink-dim mt-1.5 max-w-[680px] flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>本回复由 AI 生成，仅供参考，不构成投资建议</span>
            {isLoggedIn && message.meta && (
              <span className="text-ink-muted">
                {message.meta.isVip ? (
                  <span className="text-accent-gold">VIP · 不消耗算力</span>
                ) : message.meta.ptsCost ? (
                  <>
                    <span className="text-accent-danger">−{message.meta.ptsCost} pt</span>
                    {message.meta.ptsBalance != null && (
                      <span className="ml-1 text-ink-muted">
                        · 余额 {message.meta.ptsBalance.toLocaleString()} pts
                      </span>
                    )}
                  </>
                ) : null}
              </span>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[560px]">
        <div className="text-[10px] tracking-widest text-ink-dim mb-1.5 text-right">
          USER <span className="ml-2">{message.ts}</span>
        </div>
        <div className="bg-accent-razer/10 border border-accent-razer/30 rounded-md p-3 text-sm text-ink-bright">
          {message.imageData && (
            <img
              src={message.imageData}
              alt="K 线截图"
              className="rounded mb-2 max-h-48 object-contain"
            />
          )}
          {message.content}
        </div>
      </div>
    </div>
  );
}

function InsufficientPtsCard({ balance, needed }: { balance: number; needed: number }) {
  return (
    <div className="terminal-card max-w-[680px] p-5 border-accent-danger/40 bg-accent-danger/5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-accent-danger animate-pulseLine" />
        <span className="text-[10px] tracking-widest uppercase text-accent-danger">
          INSUFFICIENT_COMPUTE
        </span>
      </div>
      <div className="text-ink-bright text-sm">
        本次推理需 <span className="text-accent-danger font-bold">{needed} pt</span>，您当前余额仅{" "}
        <span className="text-ink-muted">{balance.toLocaleString()} pts</span>。
      </div>
      <div className="text-[11px] text-ink-muted leading-relaxed">
        充值即可继续对话，或开通 VIP 享无限算力。
      </div>
      <div className="flex gap-2 pt-1">
        <Link href="/pricing" className="btn-primary text-xs">
          立即充值 →
        </Link>
        <Link
          href="/pricing"
          className="btn-gold text-xs"
        >
          开通 VIP
        </Link>
      </div>
    </div>
  );
}

function SuggestionCards({
  suggestions,
  onPick,
}: {
  suggestions: string[];
  onPick: (s: string) => void;
}) {
  return (
    <div className="space-y-2 pt-2">
      <div className="text-[10px] tracking-widest uppercase text-ink-dim">
        💡 试试问我
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-[680px]">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="terminal-card text-left p-3 text-xs text-ink-base hover:border-accent-razer/50 hover:text-ink-bright transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
      <div className="text-[11px] text-ink-dim mt-3 max-w-[680px] leading-relaxed flex items-start gap-2">
        <svg viewBox="0 0 16 16" className="size-3.5 mt-0.5 shrink-0 text-accent-razer" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="4" width="12" height="9" rx="1" />
          <circle cx="8" cy="8.5" r="2" />
          <path d="M5 4l1-1.5h4L11 4" />
        </svg>
        <span>
          也可以点击下方<span className="text-accent-razer">相机</span>图标，
          <span className="text-ink-base">拍摄或上传 K 线截图</span>
          ，AI 会按 SMC/ICT 框架进行深度盘面剖析（每张图消耗 5 pts）。
        </span>
      </div>
    </div>
  );
}

function RegisterWall({ onClose, callbackUrl }: { onClose: () => void; callbackUrl: string }) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-bg-base/85 backdrop-blur p-6">
      <div className="terminal-card max-w-md w-full p-6 space-y-4 border-accent-razer/40 razer-glow">
        <div className="text-[10px] tracking-widest uppercase text-accent-razer">
          GUEST_QUOTA_EXCEEDED
        </div>
        <h3 className="text-ink-bright text-lg font-bold tracking-wide">
          免费试用已用完
        </h3>
        <p className="text-sm text-ink-muted leading-relaxed">
          注册即赠 <span className="text-accent-razer font-bold">500 算力点</span>
          ，足够你深度体验所有 5 个频道。通过邀请码注册还能让推荐人额外得 200 pts。
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="btn-primary flex-1"
          >
            申请节点接入 →
          </Link>
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="btn-ghost flex-1"
          >
            已有账号
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] text-ink-dim hover:text-ink-muted block mx-auto"
        >
          稍后再说
        </button>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 text-ink-dim text-xs">
      <span className="size-1.5 bg-accent-razer rounded-full animate-pulseLine" />
      <span className="size-1.5 bg-accent-razer rounded-full animate-pulseLine [animation-delay:0.2s]" />
      <span className="size-1.5 bg-accent-razer rounded-full animate-pulseLine [animation-delay:0.4s]" />
      <span className="ml-2">推理中...</span>
    </div>
  );
}

function ChatInput({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string, image?: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;
    onSend(text.trim() || "请分析这张 K 线图。", imagePreview || undefined);
    setText("");
    setImagePreview(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-bg-edge p-3 sm:p-4 bg-bg-panel/30">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-3">
          <img src={imagePreview} alt="" className="h-16 rounded border border-bg-edge" />
          <button
            type="button"
            onClick={() => setImagePreview(null)}
            className="text-xs text-accent-danger"
          >
            移除
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 terminal-card px-3 py-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="size-8 rounded grid place-items-center text-ink-muted hover:text-accent-razer"
          title="上传 K 线截图（带图分析消耗 5 pts）"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="12" height="9" rx="1" />
            <circle cx="8" cy="8.5" r="2" />
            <path d="M5 4l1-1.5h4L11 4" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none text-sm text-ink-bright placeholder:text-ink-dim min-w-0"
        />
        <button
          type="submit"
          disabled={disabled}
          className="size-8 grid place-items-center rounded bg-accent-razer/15 border border-accent-razer/40 text-accent-razer hover:bg-accent-razer/25 disabled:opacity-40"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
            <path d="M2 8l12-6-3 14-3-6-6-2z" />
          </svg>
        </button>
      </div>
    </form>
  );
}

function nowTs() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}
