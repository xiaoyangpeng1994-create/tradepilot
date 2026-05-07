"use client";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type InvitePreview =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "valid"; label: string }
  | { state: "invalid" };

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialInvite = params.get("ref") || "";

  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(initialInvite);
  const [preview, setPreview] = useState<InvitePreview>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const code = inviteCode.trim();
    if (!code) {
      setPreview({ state: "idle" });
      return;
    }
    setPreview({ state: "checking" });
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/auth/invite-preview?code=${encodeURIComponent(code)}`,
          { signal: ctrl.signal },
        );
        const data = (await res.json()) as {
          valid: boolean;
          inviterName?: string;
          isSeed?: boolean;
        };
        if (!data.valid) {
          setPreview({ state: "invalid" });
        } else if (data.isSeed) {
          setPreview({ state: "valid", label: "创世节点 · 管理员通道" });
        } else {
          setPreview({
            state: "valid",
            label: `将加入 ${data.inviterName} 的网络`,
          });
        }
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") return;
        setPreview({ state: "idle" });
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [inviteCode]);

  const inviteValid = preview.state === "valid";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteValid) {
      setError("请输入有效的邀请码");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password, inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        setLoading(false);
        return;
      }
      const signed = await signIn("credentials", {
        nickname,
        password,
        redirect: false,
      });
      if (signed?.error) {
        setError("注册成功，但自动登录失败，请手动登录。");
        setLoading(false);
        return;
      }
      router.push("/forex");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="terminal-card w-full max-w-md p-7 space-y-5 bg-bg-panel/80 backdrop-blur"
    >
      <div className="space-y-1.5">
        <div className="label-tag">NODE_REGISTRATION · SECURE_HANDSHAKE</div>
        <h1 className="text-ink-bright text-xl font-bold tracking-wide">申请节点接入</h1>
        <p className="text-ink-muted text-xs">
          注册即赠 <span className="text-accent-neon">2,500 算力点</span>，可立即体验 5 大频道 AI 推理。
        </p>
      </div>

      <div className="space-y-3">
        <Field
          label="邀请码"
          id="invite"
          type="text"
          value={inviteCode}
          onChange={setInviteCode}
          required
          autoFocus={!initialInvite}
          slot={<InvitePreviewBadge preview={preview} />}
        />
        <Field
          label="昵称"
          id="nickname"
          type="text"
          value={nickname}
          onChange={setNickname}
          required
          autoComplete="username"
          hint="登录用，2-24 位，支持中英数字"
        />
        <Field
          label="密码"
          id="password"
          type="password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="new-password"
          hint="至少 6 位"
        />
      </div>

      {error && (
        <div className="text-xs text-accent-danger border border-accent-danger/40 bg-accent-danger/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !inviteValid}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? "正在生成节点..." : "开通终端账号"}
      </button>

      <div className="text-[10px] text-ink-dim leading-relaxed border-t border-bg-edge pt-3">
        手机号短信验证将在下一版本上线，届时所有账号需补充验证以防风控。
      </div>

      <div className="text-xs text-ink-muted flex justify-between pt-1">
        <span>已有账号？</span>
        <Link href="/login" className="text-accent-info hover:text-accent-info/80">
          直接登录 →
        </Link>
      </div>
    </form>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function InvitePreviewBadge({ preview }: { preview: InvitePreview }) {
  if (preview.state === "idle") return null;
  if (preview.state === "checking") {
    return <span className="text-[10px] text-ink-dim mt-1 block">验证中...</span>;
  }
  if (preview.state === "invalid") {
    return (
      <span className="text-[10px] text-accent-danger mt-1 block">
        ✗ 邀请码无效
      </span>
    );
  }
  return (
    <span className="text-[10px] text-accent-neon mt-1 block">
      ✓ {preview.label}
    </span>
  );
}

function Field({
  label,
  id,
  type,
  value,
  onChange,
  autoComplete,
  required,
  hint,
  autoFocus,
  slot,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  autoFocus?: boolean;
  slot?: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="label-tag block mb-1">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        autoFocus={autoFocus}
        className="w-full bg-bg-card border border-bg-edge rounded-md px-3 py-2 text-sm text-ink-bright outline-none focus:border-accent-info/60 focus:bg-bg-card/80"
      />
      {slot}
      {hint && <span className="text-[10px] text-ink-dim mt-1 block">{hint}</span>}
    </label>
  );
}
