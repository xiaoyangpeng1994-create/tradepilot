"use client";
import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/forex";

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
        <div className="label-tag">SECURE_ACCESS · CREDENTIALS_MODE</div>
        <h1 className="text-ink-bright text-xl font-bold tracking-wide">登录交易终端</h1>
        <p className="text-ink-muted text-xs">用注册昵称接入彭哥 AI 算力网络。</p>
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
        {loading ? "正在握手..." : "进入终端"}
      </button>

      <div className="text-xs text-ink-muted flex justify-between pt-2 border-t border-bg-edge">
        <span>没有账号？</span>
        <Link href="/register" className="text-accent-info hover:text-accent-info/80">
          申请节点接入 →
        </Link>
      </div>
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
