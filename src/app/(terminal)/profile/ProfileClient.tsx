"use client";
import { useState } from "react";
import { signOut } from "next-auth/react";

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
  createdAt: string;
};

export function ProfileClient({ user }: { user: ProfileData }) {
  const isVipActive =
    user.vipLevel !== "FREE" &&
    (!user.vipExpiresAt || new Date(user.vipExpiresAt).getTime() > Date.now());

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <IdentityCard user={user} isVipActive={isVipActive} />
      <PasswordSection />
      <DangerSection />
    </div>
  );
}

function IdentityCard({ user, isVipActive }: { user: ProfileData; isVipActive: boolean }) {
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
          value={isVipActive ? user.vipLevel : "FREE"}
          sub={
            isVipActive && user.vipExpiresAt
              ? `到期 ${new Date(user.vipExpiresAt).toLocaleDateString("zh-CN")}`
              : "未开通"
          }
          tone={isVipActive ? "gold" : "muted"}
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
  tone: "razer" | "gold" | "muted";
}) {
  const toneClass =
    tone === "razer"
      ? "text-accent-razer"
      : tone === "gold"
        ? "text-accent-gold"
        : "text-ink-muted";
  return (
    <div className="terminal-card p-3 bg-bg-card/40">
      <div className="text-[10px] tracking-widest uppercase text-ink-dim">{label}</div>
      <div className={`mt-1 text-2xl font-light ${toneClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-ink-dim mt-0.5">{sub}</div>}
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
