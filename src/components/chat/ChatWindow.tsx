"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  COST_TEXT_PT,
  COST_IMAGE_PT,
  LOW_BALANCE_WARN_PT,
  SIGNUP_BONUS_PTS,
} from "@/lib/pricing";

const ANON_LIMIT = 5;
const ANON_KEY = "anon_chat_count";

type TradeHint =
  | {
      intent: "OPEN";
      symbol: string;
      direction: "LONG" | "SHORT";
      entryPrice: number;
    }
  | {
      intent: "CLOSE";
      tradeId: string;
      symbol: string;
      direction: "LONG" | "SHORT";
      entryPrice: number;
      exitPrice: number;
      pnlPct: number;
    };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  imageData?: string;
  ts: string;
  meta?: {
    ptsCost?: number;
    ptsBalance?: number;
    isVip?: boolean;
    insufficient?: boolean;
    modelName?: string;
    tier?: "free" | "vip";
    tradeHint?: TradeHint;
  };
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

  // 登录用户进页面时拉一次历史，把上次该频道的对话还原
  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/history?channel=${encodeURIComponent(channel)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { messages: ChatMessage[] };
        if (cancelled || !data.messages || data.messages.length === 0) return;
        // 历史前置；intro 在没有历史时才显示，所以这里直接替换为历史
        setMessages(data.messages);
      } catch {
        // 静默失败，保留默认 intro
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, channel]);

  const isEmptyState =
    messages.length === 0 ||
    (messages.length === 1 && messages[0].id === "intro");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string, imageBase64?: string) {
    // 客户端软计数（即时反馈，真正闸门在后端 IP+UA 哈希配额）
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

      // 后端 IP+UA 配额耗尽：拉起注册墙（与本地软限制对齐）
      if (res.status === 429) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
        setRegisterWall(true);
        return;
      }

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
      const tier = (res.headers.get("X-Model-Tier") as "free" | "vip" | null) ?? "free";
      const modelName = res.headers.get("X-Model-Name") ?? undefined;

      // 服务端检测到用户提到了一笔交易：解码并附到 assistant meta 里
      const hintB64 = res.headers.get("X-Trade-Hint");
      let tradeHint: TradeHint | undefined;
      if (hintB64) {
        try {
          tradeHint = JSON.parse(atob(hintB64)) as TradeHint;
        } catch {
          // ignore malformed
        }
      }

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
                  tier,
                  modelName,
                  tradeHint,
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

  async function clearHistory() {
    if (pending) return;
    if (!confirm("确认清空当前频道的对话历史？此操作不可撤销。")) return;
    try {
      await fetch(`/api/chat/history?channel=${encodeURIComponent(channel)}`, {
        method: "DELETE",
      });
    } catch {
      // 静默失败：即便后端没删成功，前端也回到 intro 状态，下次对话会重建 session
    }
    setMessages(
      intro
        ? [{ id: "intro", role: "assistant", content: intro, ts: nowTs() }]
        : [],
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {isLoggedIn && !isEmptyState && (
        <button
          type="button"
          onClick={clearHistory}
          disabled={pending}
          title="清空当前频道的对话历史"
          className="absolute top-2 right-3 z-10 text-[10px] tracking-wider text-ink-dim hover:text-accent-danger hover:border-accent-danger/40 px-2 py-1 rounded border border-bg-edge bg-bg-panel/80 backdrop-blur transition-colors disabled:opacity-40"
        >
          🗑 清空对话
        </button>
      )}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-5">
        {messages.map((m) =>
          m.role === "system" && m.meta?.insufficient ? (
            <InsufficientPtsCard key={m.id} balance={m.meta.ptsBalance ?? 0} needed={m.meta.ptsCost ?? 1} />
          ) : (
            <div key={m.id}>
              <ChatBubble message={m} isLoggedIn={isLoggedIn} />
              {m.role === "assistant" && m.meta?.tradeHint && (
                <TradeHintCard hint={m.meta.tradeHint} />
              )}
            </div>
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
    const meta = message.meta;
    const isVipReply = !!meta?.isVip;
    // D: 非 VIP 用户上传图（COST_IMAGE_PT/次）后给一条"VIP 此次免费 + 多周期联动"角标
    const showImageVipUpsell =
      isLoggedIn && !isVipReply && !!meta?.ptsCost && meta.ptsCost >= COST_IMAGE_PT;
    // A: 非 VIP 余额低于阈值（约还能问 ~3 次），加红线警示
    const showLowBalanceWarn =
      isLoggedIn && !isVipReply && meta?.ptsBalance != null && meta.ptsBalance <= LOW_BALANCE_WARN_PT;
    return (
      <div>
        <div className="text-[10px] tracking-widest text-ink-dim mb-1.5">
          PENG_GE_AI_ENGINE <span className="ml-2 text-accent-razer">{message.ts}</span>
        </div>
        <div className="terminal-card border-bg-edge p-4 max-w-[680px] text-sm text-ink-base leading-relaxed">
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : (
            <span className="text-ink-dim animate-blink">▍</span>
          )}
        </div>
        {!isIntro && message.content && (
          <div className="text-[10px] text-ink-dim mt-1.5 max-w-[680px] flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>本回复由 AI 生成，仅供参考，不构成投资建议</span>
            {meta?.modelName && (
              <span
                className={
                  meta.tier === "vip"
                    ? "px-1.5 py-0.5 rounded bg-accent-gold/15 border border-accent-gold/40 text-accent-gold tracking-wider uppercase"
                    : "px-1.5 py-0.5 rounded bg-bg-edge/60 border border-bg-edge text-ink-muted tracking-wider uppercase"
                }
                title={
                  meta.tier === "vip"
                    ? "VIP 旗舰推理引擎 · 深度报告模板"
                    : "标准推理引擎 · 升级 VIP 解锁旗舰版"
                }
              >
                {meta.tier === "vip" ? "⚡ " : ""}
                {meta.modelName}
              </span>
            )}
            {isLoggedIn && meta && (
              <span className="text-ink-muted">
                {meta.isVip ? (
                  <span className="text-accent-gold">VIP · 不消耗算力</span>
                ) : meta.ptsCost ? (
                  <>
                    <span className="text-accent-danger">−{meta.ptsCost} pt</span>
                    {meta.ptsBalance != null && (
                      <span className="ml-1 text-ink-muted">
                        · 余额 {meta.ptsBalance.toLocaleString()} pts
                      </span>
                    )}
                  </>
                ) : null}
              </span>
            )}
          </div>
        )}
        {!isIntro && message.content && showImageVipUpsell && (
          <div className="mt-1.5 max-w-[680px] flex items-center gap-2 text-[10px] px-2 py-1 rounded border border-accent-gold/30 bg-accent-gold/5 text-accent-gold">
            <span>⚡</span>
            <span className="text-ink-base">
              图片深度分析消耗 {COST_IMAGE_PT} pt（约 ¥{(COST_IMAGE_PT / 50).toFixed(2)}）；
              <span className="text-accent-gold">VIP 用户此次免费 + 多周期联动（4H/1H/15m）</span>
            </span>
            <Link
              href="/pricing"
              className="ml-auto text-accent-gold hover:underline whitespace-nowrap"
            >
              开通 VIP →
            </Link>
          </div>
        )}
        {!isIntro && message.content && showLowBalanceWarn && (
          <div className="mt-1.5 max-w-[680px] flex items-center gap-2 text-[11px] px-2.5 py-1.5 rounded border border-accent-danger/40 bg-accent-danger/5 text-accent-danger">
            <span className="size-1.5 rounded-full bg-accent-danger animate-pulseLine" />
            <span className="text-ink-base">
              算力即将耗尽（剩 {meta!.ptsBalance!.toLocaleString()} pts）
            </span>
            <Link
              href="/pricing"
              className="ml-auto text-accent-danger hover:underline whitespace-nowrap"
            >
              立即续点 →
            </Link>
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

function TradeHintCard({ hint }: { hint: TradeHint }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "dismissed" | "err">("idle");

  if (state === "dismissed") return null;

  async function save() {
    setState("saving");
    try {
      let res: Response;
      if (hint.intent === "OPEN") {
        res = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: hint.symbol,
            direction: hint.direction,
            entryPrice: hint.entryPrice,
          }),
        });
      } else {
        res = await fetch(`/api/trades/${hint.tradeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exitPrice: hint.exitPrice, close: true }),
        });
      }
      if (res.ok) setState("saved");
      else setState("err");
    } catch {
      setState("err");
    }
  }

  const dirBadge = (
    <span
      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
        hint.direction === "LONG"
          ? "bg-accent-razer/15 text-accent-razer"
          : "bg-accent-danger/15 text-accent-danger"
      }`}
    >
      {hint.direction}
    </span>
  );

  return (
    <div className="terminal-card border-accent-razer/40 bg-accent-razer/5 p-3 max-w-[680px] mt-2 mb-1">
      <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase text-accent-razer mb-2">
        <span className="size-1.5 rounded-full bg-accent-razer animate-pulseLine" />
        {hint.intent === "OPEN" ? "AI 注意到你提到了一笔开仓" : "AI 注意到你平仓了"}
      </div>

      {hint.intent === "OPEN" ? (
        <div className="text-xs text-ink-base mb-2 flex flex-wrap items-center gap-1.5">
          识别到：{dirBadge}
          <span className="text-ink-bright font-bold">{hint.symbol}</span>
          <span>入场 <span className="font-bold">{hint.entryPrice}</span></span>
        </div>
      ) : (
        <div className="text-xs text-ink-base mb-2 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            平仓：{dirBadge}
            <span className="text-ink-bright font-bold">{hint.symbol}</span>
            <span className="text-ink-muted">入 {hint.entryPrice}</span>
            <span className="text-ink-bright">→ 出 <span className="font-bold">{hint.exitPrice}</span></span>
            <span
              className={`ml-1 font-bold ${
                hint.pnlPct >= 0 ? "text-accent-razer" : "text-accent-danger"
              }`}
            >
              {hint.pnlPct >= 0 ? "+" : ""}
              {hint.pnlPct.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {state === "saved" ? (
        <div className="text-[11px] text-accent-razer flex items-center gap-2">
          ✓ {hint.intent === "OPEN" ? "已记到交易日志" : "已平仓并入日志"}
          <Link href="/journal" className="text-accent-info hover:underline">
            前往 →
          </Link>
        </div>
      ) : state === "err" ? (
        <div className="text-[11px] text-accent-danger">
          保存失败，请去 /journal 手动操作
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={state === "saving"}
            className="btn-primary text-[11px] disabled:opacity-50"
          >
            {state === "saving"
              ? "保存中..."
              : hint.intent === "OPEN"
                ? "+ 一键记录到日志"
                : "✓ 一键确认平仓"}
          </button>
          <button
            onClick={() => setState("dismissed")}
            className="text-[11px] text-ink-dim hover:text-ink-muted"
          >
            忽略
          </button>
        </div>
      )}
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
          ，AI 会按 SMC/ICT 框架进行深度盘面剖析（每张图消耗 {COST_IMAGE_PT} pts）。
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
          注册即赠 <span className="text-accent-razer font-bold">{SIGNUP_BONUS_PTS.toLocaleString()} 算力点</span>
          （约 {Math.floor(SIGNUP_BONUS_PTS / COST_TEXT_PT)} 次完整推理），通过邀请码注册还能让推荐人额外得 200 pts。
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

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (p) => <h1 className="text-base font-bold text-ink-bright mt-3 first:mt-0 mb-1.5" {...p} />,
        h2: (p) => <h2 className="text-sm font-bold text-ink-bright mt-3 first:mt-0 mb-1.5" {...p} />,
        h3: (p) => <h3 className="text-sm font-semibold text-accent-razer mt-2.5 first:mt-0 mb-1" {...p} />,
        h4: (p) => <h4 className="text-xs font-semibold text-accent-razer mt-2 first:mt-0 mb-1" {...p} />,
        p: (p) => <p className="my-1.5 first:mt-0 last:mb-0" {...p} />,
        ul: (p) => <ul className="list-disc pl-5 space-y-0.5 my-1.5" {...p} />,
        ol: (p) => <ol className="list-decimal pl-5 space-y-0.5 my-1.5" {...p} />,
        li: (p) => <li className="text-sm" {...p} />,
        strong: (p) => <strong className="text-ink-bright font-semibold" {...p} />,
        em: (p) => <em className="text-accent-razer not-italic" {...p} />,
        code: ({ children, ...rest }) => (
          <code className="bg-bg-edge px-1 py-0.5 rounded text-[12px] text-accent-razer" {...rest}>
            {children}
          </code>
        ),
        pre: (p) => <pre className="bg-bg-edge p-2 rounded text-xs overflow-x-auto my-2" {...p} />,
        blockquote: (p) => (
          <blockquote className="border-l-2 border-accent-razer/40 pl-3 my-2 text-ink-muted italic" {...p} />
        ),
        table: (p) => <table className="border-collapse text-xs my-2 w-full" {...p} />,
        th: (p) => <th className="border border-bg-edge px-2 py-1 bg-bg-edge/40 text-left" {...p} />,
        td: (p) => <td className="border border-bg-edge px-2 py-1" {...p} />,
        hr: () => <hr className="border-bg-edge my-2" />,
        a: (p) => <a className="text-accent-razer underline" target="_blank" rel="noreferrer" {...p} />,
      }}
    >
      {content}
    </ReactMarkdown>
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
          title={`上传 K 线截图（带图分析消耗 ${COST_IMAGE_PT} pts）`}
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
