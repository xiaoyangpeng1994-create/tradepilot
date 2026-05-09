"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      nickname,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("昵称或密码错误");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="terminal-card w-full max-w-md p-7 space-y-5 bg-bg-panel/80 backdrop-blur"
    >
      <div className="space-y-1.5">
        <div className="label-tag">登录</div>
        <h1 className="text-ink-bright text-xl font-bold tracking-wide">欢迎回来</h1>
        <p className="text-ink-muted text-xs">登录你的洞察AI · TradePilot 账号。</p>
      </div>

      <div className="space-y-3">
        <Field
          label="昵称"
          id="nickname"
          type="text"
          value={nickname}
          onChange={setNickname}
          autoComplete="username"
          required
          autoFocus
        />
        <Field
          label="密码"
          id="password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />
      </div>

      {error && (
        <div className="text-xs text-accent-danger border border-accent-danger/40 bg-accent-danger/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? "登录中..." : "登录"}
      </button>

      <Link
        href="/register"
        className="text-xs text-ink-muted flex justify-between items-center pt-2 border-t border-bg-edge hover:text-ink-base transition-colors"
      >
        <span>没有账号？</span>
        <span className="text-accent-info">立即注册 →</span>
      </Link>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
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
  autoFocus,
}: {
  label: string;
  id: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  autoFocus?: boolean;
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
    </label>
  );
}
