"use client";
import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SIGNUP_BONUS_PTS, COST_TEXT_PT } from "@/lib/pricing";

type InvitePreview =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "valid"; label: string }
  | { state: "invalid" };

type TradingStyle = "INTRADAY" | "SWING" | "POSITION" | "LEARNING";

const STYLE_OPTIONS: Array<{
  value: TradingStyle;
  label: string;
  desc: string;
}> = [
  {
    value: "INTRADAY",
    label: "日内",
    desc: "持仓几分钟-几小时 · 关注 15m/1H 精确入场",
  },
  {
    value: "SWING",
    label: "短线",
    desc: "持仓几天-2 周 · 关注 1H/4H 多周期共振",
  },
  {
    value: "POSITION",
    label: "长线",
    desc: "持仓 1 月+ · 关注 4H/Daily 趋势 + 宏观",
  },
  {
    value: "LEARNING",
    label: "学习中",
    desc: "尚未固定风格 · 教学型回答，鼓励小仓位实操",
  },
];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const initialInvite = params.get("ref") || "";

  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(initialInvite);
  const [tradingStyle, setTradingStyle] = useState<TradingStyle>("LEARNING");
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

  const inviteFilled = inviteCode.trim().length > 0;
  // 邀请码留空 OK；填了必须 valid 才能提交
  const inviteOK = !inviteFilled || preview.state === "valid";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inviteFilled && preview.state !== "valid") {
      setError("邀请码无效，请清空或填写有效邀请码");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, password, inviteCode, tradingStyle }),
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
      router.push("/");
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
          注册即赠 <span className="text-accent-neon">{SIGNUP_BONUS_PTS.toLocaleString()} 算力点</span>
          （约 {Math.floor(SIGNUP_BONUS_PTS / COST_TEXT_PT)} 次完整推理），跨 5 大频道立即体验。
        </p>
      </div>

      <div className="space-y-3">
        <Field
          label="邀请码（可选）"
          id="invite"
          type="text"
          value={inviteCode}
          onChange={setInviteCode}
          autoFocus={!initialInvite}
          slot={<InvitePreviewBadge preview={preview} />}
          hint="填邀请人 ID/昵称可获得双方奖励；留空也可注册（成为顶级节点）"
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

        <div>
          <span className="label-tag block mb-1.5">交易风格（用于 AI 个性化分析）</span>
          <div className="grid grid-cols-2 gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => setTradingStyle(opt.value)}
                className={`text-left p-2.5 rounded-md border text-xs transition-colors ${
                  tradingStyle === opt.value
                    ? "border-accent-razer bg-accent-razer/10 text-ink-bright"
                    : "border-bg-edge bg-bg-card hover:border-accent-razer/40 text-ink-base"
                }`}
              >
                <div className="font-bold text-sm flex items-center gap-1.5">
                  {tradingStyle === opt.value && (
                    <span className="text-accent-razer">●</span>
                  )}
                  {opt.label}
                </div>
                <div className="text-[10px] text-ink-dim mt-0.5 leading-relaxed">{opt.desc}</div>
              </button>
            ))}
          </div>
          <span className="text-[10px] text-ink-dim mt-1 block">
            注册后可在「个人中心」随时切换
          </span>
        </div>
      </div>

      {error && (
        <div className="text-xs text-accent-danger border border-accent-danger/40 bg-accent-danger/10 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !inviteOK}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? "正在生成节点..." : "开通终端账号"}
      </button>

      <div className="text-[10px] text-ink-dim leading-relaxed border-t border-bg-edge pt-3">
        手机号短信验证将在下一版本上线，届时所有账号需补充验证以防风控。
      </div>

      <Link
        href="/login"
        className="text-xs text-ink-muted flex justify-between items-center pt-1 hover:text-ink-base transition-colors"
      >
        <span>已有账号？</span>
        <span className="text-accent-info">直接登录 →</span>
      </Link>
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
