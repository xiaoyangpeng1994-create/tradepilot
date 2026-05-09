"use client";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import { TradePilotIcon } from "@/components/ui/TradePilotLogo";
import remarkGfm from "remark-gfm";
import {
  COST_TEXT_PT,
  COST_IMAGE_PT,
  LOW_BALANCE_WARN_PT,
  SIGNUP_BONUS_PTS,
  PTS_PER_YUAN,
  getVipDisplayName,
  isPaidLevel,
  isUltraLevel,
} from "@/lib/pricing";
import type { SuggestionItem } from "@/lib/intel";
import { FollowupChips } from "./FollowupChips";

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
    }
  | {
      intent: "ROUND_TRIP";
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
    tier?: "free" | "vip" | "vip_plus";
    tradeHint?: TradeHint;
    followups?: string[];
  };
};

export type QuickTag = { label: string; prefix: string };

export type ChatWindowHandle = {
  ask: (text: string) => void;
  prefillInput: (text: string) => void;
  openImagePicker: () => void;
};

export const ChatWindow = forwardRef<ChatWindowHandle, {
  channel?: string;
  sessionId?: string;
  isNew?: boolean;
  intro?: string;
  placeholder?: string;
  suggestions?: SuggestionItem[];
  quickTags?: QuickTag[];
  emptyHeader?: React.ReactNode;
}>(function ChatWindow(
  {
    channel = "general",
    sessionId,
    isNew = false,
    intro,
    placeholder = "直接问：BTC 要不要平仓？黄金今天关键位置在哪？",
    suggestions,
    quickTags,
    emptyHeader,
  },
  ref,
) {
  const { status } = useSession();
  const isLoggedIn = status === "authenticated";

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    intro
      ? [{ id: "intro", role: "assistant", content: intro, ts: nowTs() }]
      : [],
  );
  const [pending, setPending] = useState(false);
  const [registerWall, setRegisterWall] = useState(false);
  const [presetText, setPresetText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 登录用户进页面时拉历史（isNew=true 时跳过，直接清空）
  useEffect(() => {
    if (status !== "authenticated") return;
    // ?new=1 时清空消息，不拉历史
    if (isNew) {
      setMessages(intro ? [{ id: "intro", role: "assistant", content: intro, ts: nowTs() }] : []);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const url = sessionId
          ? `/api/chat/history?sessionId=${encodeURIComponent(sessionId)}`
          : `/api/chat/history?channel=${encodeURIComponent(channel)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as { messages: ChatMessage[] };
        if (cancelled || !data.messages || data.messages.length === 0) return;
        setMessages(data.messages);
      } catch {
        // 静默失败
      }
    })();
    return () => { cancelled = true; };
  }, [status, channel, sessionId, isNew]);

  const isEmptyState =
    messages.length === 0 ||
    (messages.length === 1 && messages[0].id === "intro");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  function stopGeneration() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  async function send(text: string, imageBase64?: string) {
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

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, message: text, image: imageBase64 || null }),
        signal: controller.signal,
      });

      if (res.status === 429) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
        setRegisterWall(true);
        return;
      }

      if (res.status === 402) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, role: "system" as const, content: "", meta: { insufficient: true, ptsBalance: data.have, ptsCost: data.needed } }
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
      const tier = (res.headers.get("X-Model-Tier") as "free" | "vip" | "vip_plus" | null) ?? "free";
      const modelName = res.headers.get("X-Model-Name") ?? undefined;

      const hintB64 = res.headers.get("X-Trade-Hint");
      let tradeHint: TradeHint | undefined;
      if (hintB64) {
        try { tradeHint = JSON.parse(atob(hintB64)) as TradeHint; } catch { /* ignore */ }
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          acc += chunk;
          const visible = stripFollowupComment(acc);
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: visible } : m)),
          );
        }
      } catch (readErr) {
        // AbortError 时静默处理，保留已生成内容
        if ((readErr as Error).name !== "AbortError") throw readErr;
      }
      const followups = parseFollowups(acc);
      const finalContent = stripFollowupComment(acc);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: finalContent, meta: { ptsCost: cost, ptsBalance: balance ?? undefined, isVip, tier, modelName, tradeHint, followups } }
            : m,
        ),
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: "[网络错误，请稍后重试]" } : m,
          ),
        );
      }
    } finally {
      abortRef.current = null;
      setPending(false);
    }
  }

  useImperativeHandle(ref, () => ({
    ask: (text: string) => { if (pending) return; send(text); },
    prefillInput: (text: string) => {
      setPresetText(text);
      setTimeout(() => textInputRef.current?.focus(), 30);
    },
    openImagePicker: () => { fileRef.current?.click(); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [pending]);

  async function clearHistory() {
    if (pending) return;
    if (!confirm("确认清空当前对话历史？此操作不可撤销。")) return;
    try {
      await fetch(`/api/chat/history?channel=${encodeURIComponent(channel)}`, { method: "DELETE" });
    } catch { /* 静默失败 */ }
    setMessages(intro ? [{ id: "intro", role: "assistant", content: intro, ts: nowTs() }] : []);
  }

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      {/* 清空按钮 */}
      {isLoggedIn && !isEmptyState && (
        <button
          type="button"
          onClick={clearHistory}
          disabled={pending}
          title="清空当前对话历史"
          className="absolute top-3 right-4 z-10 text-[11px] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-40"
          style={{
            color: "#737373",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          清空对话
        </button>
      )}

      {/* 消息区 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 空状态：显示 Hero + emptyHeader + suggestions */}
        {isEmptyState && (
          <div className="space-y-6 animate-fadeIn">
            {emptyHeader && <div className="space-y-3">{emptyHeader}</div>}
            {suggestions && suggestions.length > 0 && (
              <SuggestionCards suggestions={suggestions} onPick={(s) => send(s)} />
            )}
          </div>
        )}

        {/* 消息列表 */}
        {messages.map((m) =>
          m.role === "system" && m.meta?.insufficient ? (
            <InsufficientPtsCard key={m.id} balance={m.meta.ptsBalance ?? 0} needed={m.meta.ptsCost ?? 1} />
          ) : (
            <div key={m.id}>
              <ChatBubble message={m} isLoggedIn={isLoggedIn} />
              {m.role === "assistant" && m.meta?.tradeHint && (
                <TradeHintCard hint={m.meta.tradeHint} />
              )}
              {m.role === "assistant" && m.id !== "intro" && m.meta && (
                <FollowupChips
                  items={m.meta.followups && m.meta.followups.length > 0 ? m.meta.followups : DEFAULT_FOLLOWUPS}
                  onPick={(text) => { if (pending) return; send(text); }}
                />
              )}
            </div>
          ),
        )}
        {pending && <TypingDots />}
      </div>

      {/* 快捷标签 */}
      {quickTags && quickTags.length > 0 && (
        <QuickTagBar
          tags={quickTags}
          onPick={(prefix) => {
            setPresetText(prefix);
            setTimeout(() => textInputRef.current?.focus(), 30);
          }}
        />
      )}

      {/* 输入框 */}
      <ChatInput
        onSend={send}
        onStop={stopGeneration}
        pending={pending}
        placeholder={placeholder}
        presetText={presetText}
        onPresetConsumed={() => setPresetText("")}
        fileRef={fileRef}
        textInputRef={textInputRef}
      />

      {/* 注册墙 */}
      {registerWall && (
        <RegisterWall
          onClose={() => setRegisterWall(false)}
          callbackUrl={typeof window !== "undefined" ? window.location.pathname : "/"}
        />
      )}
    </div>
  );
});

// ─── ChatBubble ───────────────────────────────────────────────────────────────

function ChatBubble({ message, isLoggedIn }: { message: ChatMessage; isLoggedIn: boolean }) {
  if (message.role === "assistant") {
    const isIntro = message.id === "intro";
    const meta = message.meta;
    const isVipReply = !!meta?.isVip;
    const showImageVipUpsell =
      isLoggedIn && !isVipReply && !!meta?.ptsCost && meta.ptsCost >= COST_IMAGE_PT;
    const showLowBalanceWarn =
      isLoggedIn && !isVipReply && meta?.ptsBalance != null && meta.ptsBalance <= LOW_BALANCE_WARN_PT;
    const isPaidTier = meta?.tier === "vip" || meta?.tier === "vip_plus";

    return (
      <div className="max-w-[720px]">
        {/* AI 标识 */}
        <div className="flex items-center gap-2 mb-2">
          <TradePilotIcon size={22} />
          <span className="text-xs font-medium" style={{ color: "#a3a3a3" }}>TradePilot</span>
          <span className="text-[11px]" style={{ color: "#525252" }}>{message.ts}</span>
        </div>

        {/* 消息内容 */}
        <div className="pl-8 text-sm leading-relaxed" style={{ color: "#d4d4d4" }}>
          {message.content ? (
            <MarkdownContent content={message.content} />
          ) : (
            <span className="animate-blink" style={{ color: "#737373" }}>▍</span>
          )}
        </div>

        {/* 元信息行 */}
        {!isIntro && message.content && (
          <div className="pl-8 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]" style={{ color: "#525252" }}>
            <span>AI 生成，仅供参考，不构成投资建议</span>
            {meta?.modelName && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px]"
                style={
                  isPaidTier
                    ? { background: "rgba(247,147,26,0.1)", border: "1px solid rgba(247,147,26,0.3)", color: "#f7931a" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", color: "#737373" }
                }
              >
                {isPaidTier ? "⚡ " : ""}{meta.modelName}
              </span>
            )}
            {isLoggedIn && meta && (
              <span>
                {meta.isVip ? (
                  <span style={{ color: "#f7931a" }}>VIP · 不消耗算力</span>
                ) : meta.ptsCost ? (
                  <>
                    <span style={{ color: "#ef4444" }}>−{meta.ptsCost} pt</span>
                    {meta.ptsBalance != null && (
                      <span className="ml-1" style={{ color: "#737373" }}>
                        · 余额 {meta.ptsBalance.toLocaleString()} pts
                      </span>
                    )}
                  </>
                ) : null}
              </span>
            )}
          </div>
        )}

        {/* 图片 VIP 提示 */}
        {!isIntro && message.content && showImageVipUpsell && (
          <div
            className="pl-8 mt-2 flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg"
            style={{ background: "rgba(247,147,26,0.06)", border: "1px solid rgba(247,147,26,0.2)" }}
          >
            <span style={{ color: "#f7931a" }}>⚡</span>
            <span style={{ color: "#a3a3a3" }}>
              图片分析消耗 {COST_IMAGE_PT} pt；
              <span style={{ color: "#f7931a" }}>开启 TP-MAX 后还能看持仓风险和关键价位</span>
            </span>
            <Link href="/pricing" className="ml-auto whitespace-nowrap" style={{ color: "#f7931a" }}>
              开启 TP-MAX →
            </Link>
          </div>
        )}

        {/* 低余额警告 */}
        {!isIntro && message.content && showLowBalanceWarn && (
          <div
            className="pl-8 mt-2 space-y-1.5 text-[11px] px-3 py-2.5 rounded-lg"
            style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <div className="flex items-center gap-2" style={{ color: "#ef4444" }}>
              <span className="size-1.5 rounded-full animate-pulseLine" style={{ background: "#ef4444" }} />
              <span>算力即将耗尽（剩 {meta!.ptsBalance!.toLocaleString()} pts）</span>
            </div>
            <div className="leading-relaxed" style={{ color: "#a3a3a3" }}>
              开启 TP-MAX 后可继续看：持仓风险、关键价位、今天适合等突破还是回踩。
            </div>
            <div className="flex gap-3 pt-0.5">
              <Link href="/pricing" style={{ color: "#ef4444" }}>补充算力点 →</Link>
              <Link href="/pricing" style={{ color: "#f7931a" }}>开启 TP-MAX →</Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 用户消息
  return (
    <div className="flex justify-end">
      <div className="max-w-[560px]">
        <div className="text-[11px] mb-1.5 text-right" style={{ color: "#525252" }}>
          {message.ts}
        </div>
        <div
          className="px-4 py-3 rounded-2xl text-sm"
          style={{
            background: "#2a2a2a",
            color: "#f5f5f5",
          }}
        >
          {message.imageData && (
            <img src={message.imageData} alt="K 线截图" className="rounded-lg mb-2 max-h-48 object-contain" />
          )}
          {message.content}
        </div>
      </div>
    </div>
  );
}

// ─── TradeHintCard ────────────────────────────────────────────────────────────

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
          body: JSON.stringify({ symbol: hint.symbol, direction: hint.direction, entryPrice: hint.entryPrice }),
        });
      } else if (hint.intent === "ROUND_TRIP") {
        res = await fetch("/api/trades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: hint.symbol, direction: hint.direction, entryPrice: hint.entryPrice, exitPrice: hint.exitPrice }),
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
      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
      style={
        hint.direction === "LONG"
          ? { background: "rgba(16,163,127,0.15)", color: "#10a37f" }
          : { background: "rgba(239,68,68,0.15)", color: "#ef4444" }
      }
    >
      {hint.direction}
    </span>
  );

  return (
    <div
      className="mt-2 mb-1 ml-8 max-w-[640px] p-3 rounded-xl text-xs"
      style={{ background: "rgba(16,163,127,0.06)", border: "1px solid rgba(16,163,127,0.2)" }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: "#10a37f" }}>
        <span className="size-1.5 rounded-full animate-pulseLine" style={{ background: "#10a37f" }} />
        <span className="text-[10px] tracking-wide uppercase">
          {hint.intent === "OPEN" ? "AI 识别到一笔开仓" : hint.intent === "ROUND_TRIP" ? "AI 识别到完整交易" : "AI 识别到平仓"}
        </span>
      </div>

      {hint.intent === "OPEN" ? (
        <div className="flex flex-wrap items-center gap-1.5 mb-2" style={{ color: "#d4d4d4" }}>
          {dirBadge}
          <span className="font-semibold">{hint.symbol}</span>
          <span style={{ color: "#a3a3a3" }}>入场 <span className="font-semibold" style={{ color: "#f5f5f5" }}>{hint.entryPrice}</span></span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 mb-2" style={{ color: "#d4d4d4" }}>
          {hint.intent === "ROUND_TRIP" ? "完整交易：" : "平仓："}
          {dirBadge}
          <span className="font-semibold">{hint.symbol}</span>
          <span style={{ color: "#a3a3a3" }}>入 {hint.entryPrice}</span>
          <span>→ 出 <span className="font-semibold">{hint.exitPrice}</span></span>
          <span
            className="font-bold"
            style={{ color: hint.pnlPct >= 0 ? "#10a37f" : "#ef4444" }}
          >
            {hint.pnlPct >= 0 ? "+" : ""}{hint.pnlPct.toFixed(2)}%
          </span>
        </div>
      )}

      {state === "saved" ? (
        <div className="flex items-center gap-2" style={{ color: "#10a37f" }}>
          ✓ {hint.intent === "OPEN" ? "已加入交易画像" : "已平仓并入画像"}
          <Link href="/journal" style={{ color: "#10a37f" }}>前往 →</Link>
        </div>
      ) : state === "err" ? (
        <div style={{ color: "#ef4444" }}>保存失败，请去 /journal 手动操作</div>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={state === "saving"}
            className="btn-primary text-[11px] disabled:opacity-50"
          >
            {state === "saving" ? "保存中..." : hint.intent === "OPEN" ? "+ 保存到交易画像" : "✓ 确认平仓并入画像"}
          </button>
          <button onClick={() => setState("dismissed")} className="text-[11px]" style={{ color: "#737373" }}>
            忽略
          </button>
        </div>
      )}
    </div>
  );
}

// ─── InsufficientPtsCard ──────────────────────────────────────────────────────

function InsufficientPtsCard({ balance, needed }: { balance: number; needed: number }) {
  return (
    <div
      className="max-w-[680px] p-5 rounded-xl space-y-3"
      style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}
    >
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full animate-pulseLine" style={{ background: "#ef4444" }} />
        <span className="text-[11px] tracking-wide uppercase" style={{ color: "#ef4444" }}>算力不足</span>
      </div>
      <div className="text-sm" style={{ color: "#f5f5f5" }}>
        本次需要 <span className="font-bold" style={{ color: "#ef4444" }}>{needed} pt</span>，当前余额{" "}
        <span style={{ color: "#a3a3a3" }}>{balance.toLocaleString()} pts</span> 不够用了。
      </div>
      <div className="text-[11px] leading-relaxed" style={{ color: "#a3a3a3" }}>
        开启 TP-MAX 后，我可以继续帮你看：
        <br />1. 这笔持仓现在危险不危险
        <br />2. 哪个价位破了要重新评估
        <br />3. 今天更适合等突破还是等回踩
      </div>
      <div className="flex gap-2 pt-1">
        <Link href="/pricing" className="btn-primary text-xs">补充算力点 →</Link>
        <Link href="/pricing" className="btn-gold text-xs">开启 TP-MAX</Link>
      </div>
    </div>
  );
}

// ─── MemberStatusCard（会员胶囊，空状态显示）─────────────────────────────────

export function MemberStatusCard({
  vipLevel,
  vipExpiresAt,
  computePts,
  dailyRemaining,
}: {
  vipLevel: string;
  vipExpiresAt: string | null;
  computePts: number;
  dailyRemaining?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isVipActive =
    isPaidLevel(vipLevel) &&
    (!vipExpiresAt || new Date(vipExpiresAt).getTime() > Date.now());
  const isUltra = isUltraLevel(vipLevel) && isVipActive;
  const isMax = !isUltra && isVipActive;
  const displayTier = isVipActive ? getVipDisplayName(vipLevel) : "FREE";
  const remaining = dailyRemaining ?? 3;

  // 胶囊文案
  let capsuleText = "";
  let capsuleColor = "#a3a3a3";
  let dotColor = "#10a37f";
  if (isUltra) {
    capsuleText = `TP-ULTRA · 剩余 ${computePts.toLocaleString()} 点 · 长期交易陪练已开启`;
    capsuleColor = "#a855f7";
    dotColor = "#a855f7";
  } else if (isMax) {
    capsuleText = `TP-MAX · 剩余 ${computePts.toLocaleString()} 点 · 已开启图片分析 / 交易画像`;
    capsuleColor = "#f7931a";
    dotColor = "#f7931a";
  } else {
    capsuleText = `FREE · 今日剩余 ${remaining} 次 · 升级解锁持仓风险判断`;
  }

  return (
    <div className="max-w-[680px]">
      {/* 胶囊按钮 */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="member-capsule"
      >
        <span className="size-1.5 rounded-full shrink-0" style={{ background: dotColor }} />
        <span style={{ color: capsuleColor }}>{capsuleText}</span>
        <svg
          viewBox="0 0 16 16"
          className={`size-3 ml-1 transition-transform duration-150 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: "#737373" }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div
          className="mt-2 p-4 rounded-xl text-xs space-y-3 animate-fadeIn"
          style={{ background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {isUltra && (
            <>
              <div className="font-medium" style={{ color: "#f5f5f5" }}>⚡ {displayTier} · 旗舰版</div>
              <div className="grid grid-cols-2 gap-1.5">
                {["高阶模型", "多周期点位地图", "更长上下文", "深度复盘", "高级交易画像", "长期交易陪练"].map((f) => (
                  <div key={f} className="flex items-center gap-1.5" style={{ color: "#d4d4d4" }}>
                    <span style={{ color: "#a855f7" }}>✓</span> {f}
                  </div>
                ))}
              </div>
              {vipExpiresAt && (
                <div style={{ color: "#737373" }}>到期 {new Date(vipExpiresAt).toLocaleDateString("zh-CN")}</div>
              )}
            </>
          )}
          {isMax && (
            <>
              <div className="font-medium" style={{ color: "#f5f5f5" }}>★ {displayTier}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {["高级模型", "关键点位分析", "图片 K 线分析", "持仓风险判断", "交易画像", "今日交易观察计划"].map((f) => (
                  <div key={f} className="flex items-center gap-1.5" style={{ color: "#d4d4d4" }}>
                    <span style={{ color: "#f7931a" }}>✓</span> {f}
                  </div>
                ))}
              </div>
              {vipExpiresAt && (
                <div style={{ color: "#737373" }}>到期 {new Date(vipExpiresAt).toLocaleDateString("zh-CN")}</div>
              )}
            </>
          )}
          {!isVipActive && (
            <>
              <div className="flex items-center gap-2">
                <span className="font-medium" style={{ color: "#f5f5f5" }}>FREE</span>
                <span style={{ color: "#737373" }}>今日剩余 {remaining} 次</span>
              </div>
              <div style={{ color: "#a3a3a3" }}>
                已开启：基础关键位置分析
              </div>
              <div style={{ color: "#737373" }}>
                未开启：图片分析 · 持仓风险 · 交易画像 · 今日计划
              </div>
              <Link href="/pricing" className="inline-block" style={{ color: "#f7931a" }}>
                开启 TP-MAX →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── SuggestionCards ──────────────────────────────────────────────────────────

// 标签颜色映射
const TAG_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  red:   { bg: "rgba(239,68,68,0.1)",   color: "#ef4444", border: "rgba(239,68,68,0.25)" },
  green: { bg: "rgba(16,163,127,0.1)",  color: "#10a37f", border: "rgba(16,163,127,0.25)" },
  blue:  { bg: "rgba(59,130,246,0.1)",  color: "#60a5fa", border: "rgba(59,130,246,0.25)" },
  gray:  { bg: "rgba(115,115,115,0.12)", color: "#a3a3a3", border: "rgba(115,115,115,0.2)" },
};

function SuggestionCards({ suggestions, onPick }: { suggestions: SuggestionItem[]; onPick: (q: string) => void }) {
  return (
    <div className="space-y-2.5 max-w-[680px]">
      {/* 分隔线 + 标题 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
        <span className="text-[11px] font-medium tracking-wide" style={{ color: "#525252" }}>快速开始</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {suggestions.map((s) => {
          const tagStyle = TAG_STYLES[s.tagColor] ?? TAG_STYLES.gray;
          return (
            <button
              key={s.label}
              onClick={() => onPick(s.question)}
              className="text-left px-3.5 py-3 rounded-xl transition-all duration-150 flex flex-col gap-1.5"
              style={{
                background: "#2a2a2a",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)";
                (e.currentTarget as HTMLButtonElement).style.background = "#303030";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
                (e.currentTarget as HTMLButtonElement).style.background = "#2a2a2a";
              }}
            >
              {/* 顶部：图标 + 标签 */}
              <div className="flex items-center justify-between">
                <span className="text-base leading-none">{s.icon}</span>
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{
                    background: tagStyle.bg,
                    color: tagStyle.color,
                    border: `1px solid ${tagStyle.border}`,
                  }}
                >
                  {s.tag}
                </span>
              </div>
              {/* 标题 */}
              <div className="text-sm font-medium leading-snug" style={{ color: "#e5e5e5" }}>
                {s.label}
              </div>
            </button>
          );
        })}
      </div>
      <div className="text-[11px] leading-relaxed flex items-start gap-2 pt-1" style={{ color: "#737373" }}>
        <svg viewBox="0 0 16 16" className="size-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#10a37f" }}>
          <rect x="2" y="4" width="12" height="9" rx="1" />
          <circle cx="8" cy="8.5" r="2" />
          <path d="M5 4l1-1.5h4L11 4" />
        </svg>
        <span>
          也可点击输入框左侧<span style={{ color: "#10a37f" }}>相机</span>图标上传 K 线截图，AI 按 SMC/ICT 框架深度分析（每张 {COST_IMAGE_PT} pts）。
        </span>
      </div>
    </div>
  );
}

// ─── RegisterWall ─────────────────────────────────────────────────────────────

function RegisterWall({ onClose, callbackUrl }: { onClose: () => void; callbackUrl: string }) {
  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center p-6"
      style={{ background: "rgba(23,23,23,0.9)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="max-w-md w-full p-6 rounded-2xl space-y-4"
        style={{ background: "#212121", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="text-[11px] tracking-wide uppercase" style={{ color: "#10a37f" }}>
          免费试用已用完
        </div>
        <h3 className="text-lg font-semibold" style={{ color: "#f5f5f5" }}>
          注册即赠算力点
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: "#a3a3a3" }}>
          注册即赠 <span className="font-bold" style={{ color: "#10a37f" }}>{SIGNUP_BONUS_PTS.toLocaleString()} 算力点</span>
          （约 {Math.floor(SIGNUP_BONUS_PTS / COST_TEXT_PT)} 次完整推理），通过邀请码注册还能让推荐人额外得 200 pts。
        </p>
        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Link href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="btn-primary flex-1">
            注册新账号 →
          </Link>
          <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="btn-ghost flex-1">
            已有账号
          </Link>
        </div>
        <button type="button" onClick={onClose} className="text-[11px] block mx-auto" style={{ color: "#737373" }}>
          稍后再说
        </button>
      </div>
    </div>
  );
}

// ─── MarkdownContent ──────────────────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: (p) => <h1 className="text-base font-semibold mt-4 first:mt-0 mb-2" style={{ color: "#f5f5f5" }} {...p} />,
        h2: (p) => <h2 className="text-sm font-semibold mt-3 first:mt-0 mb-1.5" style={{ color: "#f5f5f5" }} {...p} />,
        h3: (p) => <h3 className="text-sm font-medium mt-2.5 first:mt-0 mb-1" style={{ color: "#d4d4d4" }} {...p} />,
        h4: (p) => <h4 className="text-xs font-medium mt-2 first:mt-0 mb-1" style={{ color: "#d4d4d4" }} {...p} />,
        p: (p) => <p className="my-1.5 first:mt-0 last:mb-0" {...p} />,
        ul: (p) => <ul className="list-disc pl-5 space-y-0.5 my-1.5" {...p} />,
        ol: (p) => <ol className="list-decimal pl-5 space-y-0.5 my-1.5" {...p} />,
        li: (p) => <li className="text-sm" {...p} />,
        strong: (p) => <strong className="font-semibold" style={{ color: "#f5f5f5" }} {...p} />,
        em: (p) => <em className="not-italic" style={{ color: "#d4d4d4" }} {...p} />,
        code: ({ children, ...rest }) => (
          <code
            className="px-1.5 py-0.5 rounded text-[12px] font-mono"
            style={{ background: "#303030", color: "#f5f5f5" }}
            {...rest}
          >
            {children}
          </code>
        ),
        pre: (p) => (
          <pre
            className="p-3 rounded-xl text-xs overflow-x-auto my-2"
            style={{ background: "#303030" }}
            {...p}
          />
        ),
        blockquote: (p) => (
          <blockquote
            className="pl-3 my-2"
            style={{ borderLeft: "2px solid rgba(255,255,255,0.15)", color: "#a3a3a3" }}
            {...p}
          />
        ),
        table: (p) => <table className="border-collapse text-xs my-2 w-full" {...p} />,
        th: (p) => (
          <th
            className="px-2 py-1 text-left"
            style={{ border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.04)", color: "#a3a3a3" }}
            {...p}
          />
        ),
        td: (p) => (
          <td
            className="px-2 py-1"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            {...p}
          />
        ),
        hr: () => <hr className="my-3" style={{ borderColor: "rgba(255,255,255,0.08)" }} />,
        a: (p) => <a className="underline underline-offset-2" style={{ color: "#10a37f" }} target="_blank" rel="noreferrer" {...p} />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── TypingDots ───────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 pl-8">
      <span className="size-1.5 rounded-full animate-pulseLine" style={{ background: "#10a37f" }} />
      <span className="size-1.5 rounded-full animate-pulseLine [animation-delay:0.2s]" style={{ background: "#10a37f" }} />
      <span className="size-1.5 rounded-full animate-pulseLine [animation-delay:0.4s]" style={{ background: "#10a37f" }} />
      <span className="ml-2 text-xs" style={{ color: "#737373" }}>推理中...</span>
    </div>
  );
}

// ─── QuickTagBar ──────────────────────────────────────────────────────────────

function QuickTagBar({ tags, onPick }: { tags: QuickTag[]; onPick: (prefix: string) => void }) {
  return (
    <div
      className="px-3 sm:px-4 py-2 flex items-center gap-2 overflow-x-auto"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      <span className="text-[10px] tracking-wide uppercase shrink-0 mr-1" style={{ color: "#737373" }}>快捷</span>
      {tags.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onPick(t.prefix)}
          className="shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors duration-150"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            color: "#a3a3a3",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,163,127,0.4)";
            (e.currentTarget as HTMLButtonElement).style.color = "#10a37f";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
            (e.currentTarget as HTMLButtonElement).style.color = "#a3a3a3";
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── ChatInput ────────────────────────────────────────────────────────────────

function ChatInput({
  onSend,
  onStop,
  pending,
  placeholder,
  presetText,
  onPresetConsumed,
  fileRef,
  textInputRef,
}: {
  onSend: (text: string, image?: string) => void;
  onStop: () => void;
  pending: boolean;
  placeholder: string;
  presetText: string;
  onPresetConsumed: () => void;
  fileRef: React.RefObject<HTMLInputElement>;
  textInputRef: React.RefObject<HTMLTextAreaElement>;
}) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (presetText) {
      setText((prev) => prev + presetText);
      onPresetConsumed();
    }
  }, [presetText, onPresetConsumed]);

  // textarea 自动扩展高度
  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!text.trim() && !imagePreview) return;
    onSend(text.trim() || "请分析这张 K 线图。", imagePreview || undefined);
    setText("");
    setImagePreview(null);
    // 重置高度
    if (textInputRef.current) {
      textInputRef.current.style.height = "auto";
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="px-3 sm:px-4 pb-3 pt-2"
    >
      {imagePreview && (
        <div className="mb-2 flex items-center gap-3 px-1">
          <img src={imagePreview} alt="" className="h-14 rounded-lg" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
          <button type="button" onClick={() => setImagePreview(null)} className="text-xs" style={{ color: "#ef4444" }}>
            移除
          </button>
        </div>
      )}
      <div
        className="flex items-start gap-2 px-3 py-3 rounded-2xl transition-all duration-200"
        style={{
          background: "#303030",
          border: "1px solid rgba(16,163,127,0.25)",
          boxShadow: "0 0 0 3px rgba(16,163,127,0.06), 0 2px 12px rgba(0,0,0,0.3)",
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(16,163,127,0.55)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 4px rgba(16,163,127,0.12), 0 2px 16px rgba(0,0,0,0.4)";
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(16,163,127,0.25)";
            (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 3px rgba(16,163,127,0.06), 0 2px 12px rgba(0,0,0,0.3)";
          }
        }}
      >
        {/* 上传图片按钮 */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="size-9 rounded-lg grid place-items-center transition-colors duration-150 shrink-0 mt-0.5"
          style={{ color: "#737373" }}
          title={`上传 K 线截图（带图分析消耗 ${COST_IMAGE_PT} pts）`}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#10a37f"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#737373"; }}
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="12" height="9" rx="1" />
            <circle cx="8" cy="8.5" r="2" />
            <path d="M5 4l1-1.5h4L11 4" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />

        {/* 文本输入 — textarea 多行 */}
        <textarea
          ref={textInputRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            autoResize(e.target);
          }}
          onKeyDown={(e) => {
            // Enter 发送，Shift+Enter 换行
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!pending && (text.trim() || imagePreview)) {
                onSend(text.trim() || "请分析这张 K 线图。", imagePreview || undefined);
                setText("");
                setImagePreview(null);
                if (textInputRef.current) textInputRef.current.style.height = "auto";
              }
            }
          }}
          placeholder={placeholder}
          disabled={pending}
          className="flex-1 bg-transparent outline-none text-sm min-w-0 resize-none leading-relaxed"
          style={{
            color: "#f5f5f5",
            minHeight: "24px",
            maxHeight: "200px",
            overflowY: "auto",
          }}
        />

        {/* 停止按钮（推理中）/ 发送按钮 */}
        {pending ? (
          <button
            type="button"
            onClick={onStop}
            className="size-9 grid place-items-center rounded-lg transition-colors duration-150 shrink-0 mt-0.5"
            title="停止生成"
            style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.25)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.15)";
            }}
          >
            {/* 停止图标：实心方块 */}
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
              <rect x="3" y="3" width="10" height="10" rx="1.5" />
            </svg>
          </button>
        ) : (
          <button
            type="submit"
            disabled={!text.trim() && !imagePreview}
            className="size-9 grid place-items-center rounded-lg transition-colors duration-150 shrink-0 mt-0.5 disabled:opacity-30"
            style={{
              background: "#10a37f",
              color: "#fff",
            }}
            onMouseEnter={(e) => {
              if (!(e.currentTarget as HTMLButtonElement).disabled) {
                (e.currentTarget as HTMLButtonElement).style.background = "#0d8f6f";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#10a37f";
            }}
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
              <path d="M2 8l12-6-3 14-3-6-6-2z" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-center mt-1.5 text-[10px]" style={{ color: "#4a4a4a" }}>
        Enter 发送 · Shift+Enter 换行
      </p>
    </form>
  );
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function nowTs() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

const FOLLOWUP_RE = /<!--\s*FOLLOWUPS\s*:\s*([\s\S]*?)\s*-->/;

const DEFAULT_FOLLOWUPS = ["展开看更多", "今晚风险", "继续聊"];

function parseFollowups(text: string): string[] | undefined {
  const m = text.match(FOLLOWUP_RE);
  if (!m) return undefined;
  const parts = m[1]
    .split(/[|｜]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.length <= 16)
    .slice(0, 4);
  return parts.length > 0 ? parts : undefined;
}

function stripFollowupComment(text: string): string {
  const cleaned = text.replace(FOLLOWUP_RE, "").trimEnd();
  if (cleaned !== text) return cleaned;
  const partial = text.match(/<!--\s*F?O?L?L?O?W?U?P?S?\s*:?[^>]*$/);
  if (partial) return text.slice(0, partial.index).trimEnd();
  return text;
}

export { DEFAULT_FOLLOWUPS };
