"use client";
import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import {
  SIGNUP_BONUS_PTS,
  INVITER_BONUS_PTS,
  INVITER_FIRST_PAY_BONUS_PTS,
  COST_TEXT_PT,
} from "@/lib/pricing";

type TradingStyle = "INTRADAY" | "SWING" | "POSITION" | "LEARNING";

type ProfileData = {
  id: string;
  nickname: string;
  email: string | null;
  phone: string | null;
  computePts: number;
  walletBalanceCny: string;
  vipLevel: string;
  vipExpiresAt: string | null;
  agentLevel: number;
  parentNickname: string | null;
  tradingStyle: TradingStyle;
  createdAt: string;
};

const STYLE_OPTIONS: Array<{
  value: TradingStyle;
  label: string;
  desc: string;
  intervals: string;
}> = [
  { value: "INTRADAY", label: "日内交易", desc: "持仓几分钟-几小时", intervals: "15m + 1H" },
  { value: "SWING", label: "短线/波段", desc: "持仓几天-2 周", intervals: "1H + 4H" },
  { value: "POSITION", label: "长线/趋势", desc: "持仓 1 月+", intervals: "4H + Daily" },
  { value: "LEARNING", label: "学习中", desc: "尚未固定风格", intervals: "1H + 4H · 教学" },
];

type InviteStats = {
  invitedCount: number;
  invitedEarnedPts: number;
};

export function ProfileClient({
  user,
  inviteStats = { invitedCount: 0, invitedEarnedPts: 0 },
}: {
  user: ProfileData;
  inviteStats?: InviteStats;
}) {
  const isVipActive =
    user.vipLevel !== "FREE" &&
    (!user.vipExpiresAt || new Date(user.vipExpiresAt).getTime() > Date.now());
  const isVipPlusActive =
    isVipActive && (user.vipLevel === "TP_ULTRA_MONTH" || user.vipLevel === "TP_ULTRA_YEAR");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <IdentityCard user={user} isVipActive={isVipActive} isVipPlusActive={isVipPlusActive} />
      <InviteSection nickname={user.nickname} inviteStats={inviteStats} />
      <TradingStyleSection initial={user.tradingStyle} />
      <PasswordSection />
      {user.agentLevel >= 1 && <AgentEntrySection />}
      <DangerSection />
    </div>
  );
}

function IdentityCard({
  user,
  isVipActive,
  isVipPlusActive,
}: {
  user: ProfileData;
  isVipActive: boolean;
  isVipPlusActive: boolean;
}) {
  return (
    <div className="terminal-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-ink-dim">
          NODE_IDENTITY
        </span>
        <span className="text-[10px] text-ink-dim">
          注册于 {new Date(user.createdAt).toLocaleDateString("zh-CN")}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 text-xs">
        <Field label="昵称" value={user.nickname} highlight />
        <Field label="节点 ID" value={user.id.slice(-10)} mono />
        <Field
          label="父级邀请人"
          value={user.parentNickname ?? "—（顶级节点）"}
        />
        <Field label="邮箱" value={user.email ?? "未绑定"} />
        <Field label="手机" value={user.phone ?? "未绑定（短信验证待上线）"} />
        <Field
          label="代理等级"
          value={
            user.agentLevel === 0
              ? "普通用户"
              : user.agentLevel === 1
                ? "直属代理"
                : "二级代理"
          }
        />
      </div>

      <div className="border-t border-bg-edge pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat
          label="算力余额"
          value={
            isVipActive
              ? "∞"
              : user.computePts.toLocaleString()
          }
          sub={isVipActive ? "VIP 无限" : "pts"}
          tone={isVipActive ? "gold" : "razer"}
        />
        <Stat
          label="可结算钱包"
          value={`¥${user.walletBalanceCny}`}
          sub="累计分润收入"
          tone="razer"
        />
        <Stat
          label="VIP 等级"
          value={isVipPlusActive ? "ULTRA" : isVipActive ? user.vipLevel : "FREE"}
          sub={
            isVipActive && user.vipExpiresAt
              ? `到期 ${new Date(user.vipExpiresAt).toLocaleDateString("zh-CN")}`
              : "未开通"
          }
          tone={isVipPlusActive ? "purple" : isVipActive ? "gold" : "muted"}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] tracking-widest uppercase text-ink-dim">{label}</div>
      <div
        className={`mt-1 text-sm break-all ${
          highlight ? "text-ink-bright font-bold" : "text-ink-base"
        } ${mono ? "font-mono text-[11px]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "razer" | "gold" | "muted" | "purple";
}) {
  const toneClass =
    tone === "razer"
      ? "text-accent-razer"
      : tone === "gold"
        ? "text-accent-gold"
        : tone === "purple"
          ? "text-accent-purple"
          : "text-ink-muted";
  return (
    <div className="terminal-card p-3 bg-bg-card/40">
      <div className="text-[10px] tracking-widest uppercase text-ink-dim">{label}</div>
      <div className={`mt-1 text-2xl font-light ${toneClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-dim mt-0.5">{sub}</div>}
    </div>
  );
}

function TradingStyleSection({ initial }: { initial: TradingStyle }) {
  const [style, setStyle] = useState<TradingStyle>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function pick(v: TradingStyle) {
    if (v === style || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile/style", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradingStyle: v }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "保存失败" });
      } else {
        setStyle(v);
        setMsg({ kind: "ok", text: "✓ 已切换，下次对话起 AI 按新风格分析" });
      }
    } catch {
      setMsg({ kind: "err", text: "网络异常" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="terminal-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-ink-dim">
          AI · TRADING STYLE
        </span>
        <span className="text-[10px] text-ink-dim">影响 K 线周期 + 回答风格</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STYLE_OPTIONS.map((opt) => {
          const active = style === opt.value;
          return (
            <button
              type="button"
              key={opt.value}
              onClick={() => pick(opt.value)}
              disabled={busy}
              className={`text-left p-3 rounded-md border text-xs transition-colors ${
                active
                  ? "border-accent-razer bg-accent-razer/10 text-ink-bright"
                  : "border-bg-edge bg-bg-card hover:border-accent-razer/40 text-ink-base"
              } ${busy ? "opacity-60 cursor-wait" : ""}`}
            >
              <div className="font-bold text-sm flex items-center gap-1.5">
                {active && <span className="text-accent-razer">●</span>}
                {opt.label}
              </div>
              <div className="text-[10px] text-ink-dim mt-1 leading-relaxed">{opt.desc}</div>
              <div className="text-[10px] text-accent-razer mt-1 tracking-wider">
                {opt.intervals}
              </div>
            </button>
          );
        })}
      </div>
      {msg && (
        <div
          className={`text-xs rounded px-3 py-2 border ${
            msg.kind === "ok"
              ? "border-accent-razer/50 bg-accent-razer/10 text-accent-razer"
              : "border-accent-danger/50 bg-accent-danger/10 text-accent-danger"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

function PasswordSection() {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPwd !== confirmPwd) {
      setMsg({ kind: "err", text: "两次新密码不一致" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error ?? "修改失败" });
      } else {
        setMsg({ kind: "ok", text: "✓ 密码已更新，下次登录请用新密码" });
        setOldPwd("");
        setNewPwd("");
        setConfirmPwd("");
      }
    } catch {
      setMsg({ kind: "err", text: "网络异常" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="terminal-card p-5 space-y-3">
      <div className="text-[10px] tracking-widest uppercase text-ink-dim">
        SECURITY · PASSWORD
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <PwdInput
          label="原密码"
          value={oldPwd}
          onChange={setOldPwd}
          autoComplete="current-password"
        />
        <PwdInput
          label="新密码（≥6位）"
          value={newPwd}
          onChange={setNewPwd}
          autoComplete="new-password"
        />
        <PwdInput
          label="再输一遍"
          value={confirmPwd}
          onChange={setConfirmPwd}
          autoComplete="new-password"
        />
      </div>
      {msg && (
        <div
          className={`text-xs rounded px-3 py-2 border ${
            msg.kind === "ok"
              ? "border-accent-razer/50 bg-accent-razer/10 text-accent-razer"
              : "border-accent-danger/50 bg-accent-danger/10 text-accent-danger"
          }`}
        >
          {msg.text}
        </div>
      )}
      <button
        type="submit"
        disabled={busy || !oldPwd || !newPwd}
        className="btn-primary text-xs disabled:opacity-50"
      >
        {busy ? "提交中..." : "更新密码"}
      </button>
    </form>
  );
}

function PwdInput({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-widest uppercase text-ink-dim block mb-1">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full bg-bg-card border border-bg-edge rounded-md px-3 py-2 text-sm text-ink-bright outline-none focus:border-accent-razer/60"
      />
    </label>
  );
}

function DangerSection() {
  return (
    <div className="terminal-card p-5 border-bg-edge space-y-3">
      <div className="text-[10px] tracking-widest uppercase text-ink-dim">SESSION</div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn-ghost text-xs hover:border-accent-danger/60 hover:text-accent-danger"
      >
        登出当前设备
      </button>
      <div className="text-[10px] text-ink-dim leading-relaxed">
        手机绑定、邮箱补全、登录历史等功能将在下一版本上线。
      </div>
    </div>
  );
}

// ─── 邀请好友区块 ─────────────────────────────────────────────────────────────

function InviteSection({
  nickname,
  inviteStats,
}: {
  nickname: string;
  inviteStats: { invitedCount: number; invitedEarnedPts: number };
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"link" | "template" | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const url = origin ? `${origin}/register?ref=${encodeURIComponent(nickname)}` : "";
  const template = url
    ? `🚀 我在用「洞察AI · TradePilot」做交易决策辅助，AI 帮我看关键位置、分析持仓风险、复盘交易习惯，覆盖外汇/黄金/加密/美股/A股。

通过我的链接注册：
${url}

✅ 注册即赠 ${SIGNUP_BONUS_PTS.toLocaleString()} 算力点（约 ${Math.floor(SIGNUP_BONUS_PTS / COST_TEXT_PT)} 次完整分析）
✅ 完全免费，注册就能用`
    : "";

  async function copy(text: string, kind: "link" | "template") {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  return (
    <div className="terminal-card p-5 space-y-4">
      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full animate-pulseLine" style={{ background: "#10a37f" }} />
          <span className="text-[10px] tracking-widest uppercase text-ink-dim">邀请好友 · 双方得算力</span>
        </div>
        {inviteStats.invitedCount > 0 && (
          <span className="text-[11px]" style={{ color: "#10a37f" }}>
            已邀请 {inviteStats.invitedCount} 人 · 累计获得 {inviteStats.invitedEarnedPts.toLocaleString()} pts
          </span>
        )}
      </div>

      {/* 奖励说明 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          className="rounded-xl p-3 space-y-1"
          style={{ background: "rgba(16,163,127,0.06)", border: "1px solid rgba(16,163,127,0.12)" }}
        >
          <div className="text-[10px] tracking-wide uppercase" style={{ color: "#10a37f" }}>好友注册</div>
          <div className="text-lg font-light" style={{ color: "#f5f5f5" }}>+{SIGNUP_BONUS_PTS.toLocaleString()} pts</div>
          <div className="text-[11px]" style={{ color: "#737373" }}>好友获得注册奖励</div>
        </div>
        <div
          className="rounded-xl p-3 space-y-1"
          style={{ background: "rgba(16,163,127,0.06)", border: "1px solid rgba(16,163,127,0.12)" }}
        >
          <div className="text-[10px] tracking-wide uppercase" style={{ color: "#10a37f" }}>你的奖励</div>
          <div className="text-lg font-light" style={{ color: "#f5f5f5" }}>+{INVITER_BONUS_PTS.toLocaleString()} pts</div>
          <div className="text-[11px]" style={{ color: "#737373" }}>好友注册成功后到账</div>
        </div>
        <div
          className="rounded-xl p-3 space-y-1"
          style={{ background: "rgba(247,147,26,0.06)", border: "1px solid rgba(247,147,26,0.12)" }}
        >
          <div className="text-[10px] tracking-wide uppercase" style={{ color: "#f7931a" }}>好友首次付费</div>
          <div className="text-lg font-light" style={{ color: "#f5f5f5" }}>+{INVITER_FIRST_PAY_BONUS_PTS.toLocaleString()} pts</div>
          <div className="text-[11px]" style={{ color: "#737373" }}>额外奖励自动到账</div>
        </div>
      </div>

      {/* 邀请链接 */}
      <div className="space-y-2">
        <div className="text-[10px] tracking-widest uppercase text-ink-dim">你的专属邀请链接</div>
        <div className="flex gap-2">
          <input
            readOnly
            value={url || "加载中..."}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 bg-bg-card border border-bg-edge rounded-lg px-3 py-2 text-[12px] text-ink-bright outline-none font-mono"
          />
          <button
            onClick={() => copy(url, "link")}
            disabled={!url}
            className="btn-ghost text-xs shrink-0 disabled:opacity-40"
          >
            {copied === "link" ? "✓ 已复制" : "复制链接"}
          </button>
        </div>
        <button
          onClick={() => copy(template, "template")}
          disabled={!url}
          className="btn-primary text-xs w-full disabled:opacity-40"
        >
          {copied === "template" ? "✓ 已复制推广话术" : "📋 一键复制推广话术"}
        </button>
      </div>
    </div>
  );
}

// ─── 代理后台入口（agentLevel >= 1 才显示）────────────────────────────────────

function AgentEntrySection() {
  return (
    <div
      className="terminal-card p-4 flex items-center justify-between gap-4"
      style={{ borderColor: "rgba(247,147,26,0.2)" }}
    >
      <div className="space-y-0.5">
        <div className="text-[10px] tracking-widest uppercase" style={{ color: "#f7931a" }}>代理商后台</div>
        <div className="text-sm text-ink-base">查看分润流水、管理下级节点</div>
      </div>
      <a
        href="/agent"
        className="btn-ghost text-xs shrink-0"
        style={{ borderColor: "rgba(247,147,26,0.3)", color: "#f7931a" }}
      >
        进入代理后台 →
      </a>
    </div>
  );
}
