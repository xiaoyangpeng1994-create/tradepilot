"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  fenToYuan,
  ItemCode,
  PRICING,
  CUSTOM_RECHARGE_MIN_YUAN,
  CUSTOM_RECHARGE_MAX_YUAN,
  PTS_PER_YUAN,
  getVipDisplayName,
  isPaidLevel,
  isUltraLevel,
} from "@/lib/pricing";

type Initial = {
  isLoggedIn: boolean;
  nickname: string | null;
  computePts: number;
  vipLevel: string;
  vipExpiresAt: string | null;
};

type BuyPayload = { itemCode: string; customAmountYuan?: number };

// 内测模式开关：NEXT_PUBLIC_BETA_MODE=true 时隐藏付费入口，展示"内测免费"提示
const BETA_MODE = process.env.NEXT_PUBLIC_BETA_MODE === "true";

export function PricingClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [buying, setBuying] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const isVipActive =
    isPaidLevel(initial.vipLevel) &&
    (!initial.vipExpiresAt || new Date(initial.vipExpiresAt).getTime() > Date.now());

  async function buy(payload: BuyPayload, label: string) {
    if (!initial.isLoggedIn) {
      setToast({ kind: "err", text: "请先登录后再购买" });
      return;
    }
    if (!confirm(`确认购买「${label}」？开发模式将立即模拟支付完成。`)) return;
    const key =
      payload.customAmountYuan != null
        ? `CUSTOM:${payload.customAmountYuan}`
        : payload.itemCode;
    setBuying(key);
    setToast(null);
    try {
      const res = await fetch("/api/order/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ kind: "err", text: data.error || "购买失败" });
      } else {
        setToast({ kind: "ok", text: `购买成功（订单 ${data.orderId.slice(0, 8)}…）` });
        router.refresh();
      }
    } catch {
      setToast({ kind: "err", text: "网络异常，请稍后重试" });
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-12">
      {/* 页头 */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-semibold" style={{ color: "#f5f5f5" }}>选择你的方案</h1>
        <p className="text-sm" style={{ color: "#a3a3a3" }}>
          从免费开始，随时升级。所有方案均可随时取消。
        </p>
      </div>

      {/* 账户状态 */}
      <AccountStatus initial={initial} isVipActive={isVipActive} />

      {/* 内测横幅 */}
      {BETA_MODE && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{
            background: "rgba(16,163,127,0.08)",
            border: "1px solid rgba(16,163,127,0.25)",
            color: "#10a37f",
          }}
        >
          <span className="text-base">🎉</span>
          <span>
            <strong>内测期间全功能免费体验</strong>——注册即获 2,000 算力点，够用很久。
            正式收费前会提前通知。
          </span>
        </div>
      )}

      {/* 三栏会员卡 */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FreeTierCard />
          <MaxTierCard buying={buying} onBuy={buy} betaMode={BETA_MODE} />
          <UltraTierCard buying={buying} onBuy={buy} betaMode={BETA_MODE} />
        </div>
      </section>

      {/* 算力点充值 */}
      {!BETA_MODE && <PtsSection buying={buying} onBuy={buy} />}

      {/* 代理合作 */}
      <AgentSection />

      {/* 开发模式说明（仅非内测模式显示） */}
      {!BETA_MODE && (
        <div className="text-[11px] leading-relaxed" style={{ color: "#525252" }}>
          当前为开发模式：点击购买后系统会立即模拟支付完成，自动结算上下游分润；正式版将接入支付网关 + 异步回调。
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm z-50"
          style={
            toast.kind === "ok"
              ? { background: "rgba(16,163,127,0.15)", border: "1px solid rgba(16,163,127,0.3)", color: "#10a37f" }
              : { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }
          }
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

// ─── 账户状态 ─────────────────────────────────────────────────────────────────

function AccountStatus({ initial, isVipActive }: { initial: Initial; isVipActive: boolean }) {
  if (!initial.isLoggedIn) {
    return (
      <div
        className="flex items-center justify-between p-4 rounded-xl"
        style={{ background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-sm" style={{ color: "#a3a3a3" }}>购买前请先登录账号。</span>
        <Link href="/login?callbackUrl=/pricing" className="btn-primary text-sm">去登录</Link>
      </div>
    );
  }
  const displayTier = getVipDisplayName(initial.vipLevel);
  return (
    <div
      className="flex items-center gap-6 p-4 rounded-xl flex-wrap"
      style={{ background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div>
        <div className="text-[10px] tracking-wide uppercase mb-0.5" style={{ color: "#737373" }}>账号</div>
        <div className="text-sm" style={{ color: "#f5f5f5" }}>{initial.nickname}</div>
      </div>
      <div>
        <div className="text-[10px] tracking-wide uppercase mb-0.5" style={{ color: "#737373" }}>算力余额</div>
        <div className="text-sm font-medium" style={{ color: "#10a37f" }}>
          {initial.computePts.toLocaleString()} <span style={{ color: "#737373" }}>pts</span>
        </div>
      </div>
      <div>
        <div className="text-[10px] tracking-wide uppercase mb-0.5" style={{ color: "#737373" }}>当前方案</div>
        <div
          className="text-sm font-medium"
          style={{ color: isVipActive ? "#f7931a" : "#a3a3a3" }}
        >
          {displayTier}
          {isVipActive && initial.vipExpiresAt && (
            <span className="text-[11px] ml-2 font-normal" style={{ color: "#737373" }}>
              到期 {new Date(initial.vipExpiresAt).toLocaleDateString("zh-CN")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FREE 卡 ──────────────────────────────────────────────────────────────────

function FreeTierCard() {
  return (
    <div
      className="p-6 rounded-2xl flex flex-col gap-5"
      style={{ background: "#212121", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div>
        <div className="text-[11px] tracking-wide uppercase mb-1.5" style={{ color: "#737373" }}>FREE</div>
        <div className="text-base font-semibold mb-1" style={{ color: "#f5f5f5" }}>先看懂当前市场位置</div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold" style={{ color: "#a3a3a3" }}>¥0</span>
          <span className="text-xs" style={{ color: "#737373" }}>/永久</span>
        </div>
      </div>
      <ul className="space-y-2.5 flex-1">
        {[
          "每天基础问答（3次）",
          "1–2 个关键位置",
          "基础支撑 / 压力",
          "小白短答",
          "新人礼 500 点",
        ].map((f) => <FeatureRow key={f} text={f} />)}
      </ul>
      <Link
        href="/login"
        className="w-full text-center py-2.5 rounded-xl text-sm transition-colors duration-150"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          color: "#a3a3a3",
        }}
      >
        免费开始体验
      </Link>
    </div>
  );
}

// ─── TP-MAX 卡 ────────────────────────────────────────────────────────────────

function MaxTierCard({
  buying,
  onBuy,
  betaMode = false,
}: {
  buying: string | null;
  onBuy: (payload: BuyPayload, label: string) => void;
  betaMode?: boolean;
}) {
  const [cycle, setCycle] = useState<"month" | "year">("month");
  const isMonthBuying = buying === "TP_MAX_MONTH";
  const isYearBuying = buying === "TP_MAX_YEAR";
  const isBuying = isMonthBuying || isYearBuying;

  return (
    <div
      className="p-6 rounded-2xl flex flex-col gap-5 relative"
      style={{
        background: "#212121",
        border: "1px solid rgba(247,147,26,0.35)",
      }}
    >
      {/* 推荐标记 */}
      <span
        className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] tracking-wide px-3 py-0.5 rounded-full whitespace-nowrap"
        style={{
          background: "rgba(247,147,26,0.15)",
          border: "1px solid rgba(247,147,26,0.4)",
          color: "#f7931a",
        }}
      >
        ★ 推荐
      </span>

      <div>
        <div className="text-[11px] tracking-wide uppercase mb-1.5" style={{ color: "#f7931a" }}>TP-MAX</div>
        <div className="text-base font-semibold mb-1" style={{ color: "#f5f5f5" }}>看懂关键点位和持仓风险</div>
        <div className="mb-2">
          {cycle === "month" ? (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: "#f7931a" }}>¥199</span>
              <span className="text-xs" style={{ color: "#737373" }}>/月</span>
              <span className="text-[11px] line-through" style={{ color: "#525252" }}>¥299</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(247,147,26,0.1)", color: "#f7931a" }}
              >内测价</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: "#f7931a" }}>¥2,999</span>
              <span className="text-xs" style={{ color: "#737373" }}>/年</span>
              <span className="text-[11px]" style={{ color: "#10a37f" }}>折合 ¥250/月</span>
            </div>
          )}
        </div>
        {/* 周期切换 */}
        <div className="flex gap-1">
          {(["month", "year"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className="text-[11px] px-2.5 py-0.5 rounded-lg transition-colors duration-150"
              style={
                cycle === c
                  ? { background: "rgba(247,147,26,0.15)", border: "1px solid rgba(247,147,26,0.4)", color: "#f7931a" }
                  : { background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#737373" }
              }
            >
              {c === "month" ? "月付" : "年付"}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2.5 flex-1">
        {[
          "今日交易观察计划",
          "图片 K 线分析",
          "关键支撑 / 压力",
          "持仓风险判断",
          "交易画像",
          "最近 5 笔复盘",
          "每月赠送 30,000 点",
        ].map((f) => <FeatureRow key={f} text={f} gold />)}
      </ul>

      {betaMode ? (
        <div
          className="w-full py-2.5 rounded-xl text-sm text-center"
          style={{
            background: "rgba(247,147,26,0.08)",
            border: "1px solid rgba(247,147,26,0.2)",
            color: "#f7931a",
          }}
        >
          内测期间免费体验 ✓
        </div>
      ) : (
        <button
          disabled={isBuying}
          onClick={() =>
            cycle === "month"
              ? onBuy({ itemCode: "TP_MAX_MONTH" }, "TP-MAX 月付 ¥199/月")
              : onBuy({ itemCode: "TP_MAX_YEAR" }, "TP-MAX 年付 ¥2,999/年")
          }
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 disabled:opacity-50"
          style={{ background: "#f7931a", color: "#fff" }}
        >
          {isBuying ? "处理中..." : "开启 TP-MAX"}
        </button>
      )}
    </div>
  );
}

// ─── TP-ULTRA 卡 ──────────────────────────────────────────────────────────────

function UltraTierCard({
  buying,
  onBuy,
  betaMode = false,
}: {
  buying: string | null;
  onBuy: (payload: BuyPayload, label: string) => void;
  betaMode?: boolean;
}) {
  const [cycle, setCycle] = useState<"month" | "year">("month");
  const isMonthBuying = buying === "TP_ULTRA_MONTH";
  const isYearBuying = buying === "TP_ULTRA_YEAR";
  const isBuying = isMonthBuying || isYearBuying;

  return (
    <div
      className="p-6 rounded-2xl flex flex-col gap-5"
      style={{
        background: "#212121",
        border: "1px solid rgba(168,85,247,0.25)",
      }}
    >
      <div>
        <div className="text-[11px] tracking-wide uppercase mb-1.5" style={{ color: "#a855f7" }}>TP-ULTRA</div>
        <div className="text-base font-semibold mb-1" style={{ color: "#f5f5f5" }}>让 AI 成为你的长期交易陪练</div>
        <div className="mb-2">
          {cycle === "month" ? (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: "#a855f7" }}>¥599</span>
              <span className="text-xs" style={{ color: "#737373" }}>/月</span>
              <span className="text-[11px] line-through" style={{ color: "#525252" }}>¥999</span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(168,85,247,0.1)", color: "#a855f7" }}
              >内测价</span>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" style={{ color: "#a855f7" }}>¥9,999</span>
              <span className="text-xs" style={{ color: "#737373" }}>/年</span>
              <span className="text-[11px]" style={{ color: "#10a37f" }}>折合 ¥833/月</span>
            </div>
          )}
        </div>
        <div className="flex gap-1">
          {(["month", "year"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className="text-[11px] px-2.5 py-0.5 rounded-lg transition-colors duration-150"
              style={
                cycle === c
                  ? { background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.4)", color: "#a855f7" }
                  : { background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#737373" }
              }
            >
              {c === "month" ? "月付" : "年付"}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2.5 flex-1">
        {[
          "高阶模型",
          "多周期点位地图",
          "更长上下文",
          "会话摘要",
          "深度复盘",
          "高级交易画像",
          "持仓风险拆解",
          "每月赠送 120,000 点",
        ].map((f) => <FeatureRow key={f} text={f} purple />)}
      </ul>

      {betaMode ? (
        <div
          className="w-full py-2.5 rounded-xl text-sm text-center"
          style={{
            background: "rgba(168,85,247,0.08)",
            border: "1px solid rgba(168,85,247,0.2)",
            color: "#a855f7",
          }}
        >
          内测期间免费体验 ✓
        </div>
      ) : (
        <button
          disabled={isBuying}
          onClick={() =>
            cycle === "month"
              ? onBuy({ itemCode: "TP_ULTRA_MONTH" }, "TP-ULTRA 月付 ¥599/月")
              : onBuy({ itemCode: "TP_ULTRA_YEAR" }, "TP-ULTRA 年付 ¥9,999/年")
          }
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors duration-150 disabled:opacity-50"
          style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.4)", color: "#a855f7" }}
        >
          {isBuying ? "处理中..." : "开启 TP-ULTRA"}
        </button>
      )}
    </div>
  );
}

// ─── 算力点充值包 ─────────────────────────────────────────────────────────────

const PTS_PACKS: {
  code: ItemCode;
  yuan: number;
  base: number;
  bonus: number;
  total: number;
}[] = [
  { code: "PTS_29", yuan: 29, base: 2900, bonus: 100, total: 3000 },
  { code: "PTS_99", yuan: 99, base: 10000, bonus: 2000, total: 12000 },
  { code: "PTS_199", yuan: 199, base: 20000, bonus: 8000, total: 28000 },
  { code: "PTS_499", yuan: 499, base: 50000, bonus: 30000, total: 80000 },
];

function PtsSection({
  buying,
  onBuy,
}: {
  buying: string | null;
  onBuy: (payload: BuyPayload, label: string) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-base font-semibold mb-1" style={{ color: "#f5f5f5" }}>算力点充值</h2>
        <p className="text-sm" style={{ color: "#a3a3a3" }}>
          算力点是 AI 调用燃料。VIP 每月赠送，也可单独充值。
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {PTS_PACKS.map((pack) => {
          const isBuying = buying === pack.code;
          const isHighlight = pack.yuan === 99;
          return (
            <div
              key={pack.code}
              className="p-4 rounded-xl flex flex-col gap-3 transition-colors duration-150"
              style={{
                background: "#212121",
                border: isHighlight ? "1px solid rgba(16,163,127,0.3)" : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div>
                <div className="text-xl font-bold" style={{ color: "#f5f5f5" }}>¥{pack.yuan}</div>
                {pack.bonus > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    <div className="text-xs" style={{ color: "#a3a3a3" }}>{pack.base.toLocaleString()} 点</div>
                    <div className="text-[11px] font-medium" style={{ color: "#10a37f" }}>+ 赠 {pack.bonus.toLocaleString()} 点</div>
                    <div className="text-[10px]" style={{ color: "#737373" }}>共 {pack.total.toLocaleString()} 点</div>
                  </div>
                ) : (
                  <div className="mt-1 text-xs" style={{ color: "#a3a3a3" }}>{pack.total.toLocaleString()} 点</div>
                )}
              </div>
              <button
                disabled={isBuying}
                onClick={() => onBuy({ itemCode: pack.code }, `¥${pack.yuan} → ${pack.total.toLocaleString()} pts`)}
                className="mt-auto py-2 rounded-lg text-xs font-medium transition-colors duration-150 disabled:opacity-50"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#d4d4d4",
                }}
              >
                {isBuying ? "处理中..." : "立即充值"}
              </button>
            </div>
          );
        })}
      </div>

      {/* 消耗参考 */}
      <div
        className="p-4 rounded-xl space-y-3"
        style={{ background: "#212121", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="text-[11px] tracking-wide uppercase" style={{ color: "#737373" }}>算力点消耗参考</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs">
          {[
            ["基础短答", "20 点"],
            ["标准点位分析", "60 点"],
            ["持仓风险判断", "100 点"],
            ["图片 K 线分析", "300 点"],
            ["今日交易观察计划", "300–500 点"],
            ["最近 5 笔复盘", "500 点"],
          ].map(([label, cost]) => (
            <div key={label} className="flex justify-between gap-2">
              <span style={{ color: "#a3a3a3" }}>{label}</span>
              <span className="font-mono" style={{ color: "#f5f5f5" }}>{cost}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 自定义充值 */}
      <CustomRecharge buying={buying} onBuy={onBuy} />
    </section>
  );
}

function CustomRecharge({
  buying,
  onBuy,
}: {
  buying: string | null;
  onBuy: (payload: BuyPayload, label: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const yuan = Number(amount);
  const valid =
    Number.isInteger(yuan) &&
    yuan >= CUSTOM_RECHARGE_MIN_YUAN &&
    yuan <= CUSTOM_RECHARGE_MAX_YUAN;
  const pts = valid ? yuan * PTS_PER_YUAN : 0;
  const isBuying = buying?.startsWith("CUSTOM:") ?? false;

  return (
    <div
      className="p-4 rounded-xl"
      style={{ background: "#212121", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="text-sm font-medium mb-3" style={{ color: "#f5f5f5" }}>自定义金额充值</div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[160px]">
          <div className="text-[10px] tracking-wide uppercase mb-1" style={{ color: "#737373" }}>充值金额（元）</div>
          <div
            className="flex items-center px-3 py-2 rounded-lg"
            style={{ background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="text-sm mr-2" style={{ color: "#737373" }}>¥</span>
            <input
              type="number"
              inputMode="numeric"
              min={CUSTOM_RECHARGE_MIN_YUAN}
              max={CUSTOM_RECHARGE_MAX_YUAN}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${CUSTOM_RECHARGE_MIN_YUAN}-${CUSTOM_RECHARGE_MAX_YUAN}`}
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: "#f5f5f5" }}
            />
          </div>
        </div>
        <div className="min-w-[120px]">
          <div className="text-[10px] tracking-wide uppercase mb-1" style={{ color: "#737373" }}>将获得</div>
          <div className="text-lg font-bold" style={{ color: "#10a37f" }}>
            {valid ? pts.toLocaleString() : "—"}{" "}
            <span className="text-[11px] font-normal" style={{ color: "#737373" }}>pts</span>
          </div>
        </div>
        <button
          disabled={!valid || isBuying}
          onClick={() => onBuy({ itemCode: "PTS_CUSTOM", customAmountYuan: yuan }, `自定义充值 ¥${yuan} → ${pts.toLocaleString()} pts`)}
          className="py-2 px-4 rounded-lg text-sm font-medium transition-colors duration-150 disabled:opacity-40"
          style={{ background: "#10a37f", color: "#fff" }}
        >
          {isBuying ? "处理中..." : "立即充值"}
        </button>
      </div>
      <div className="text-[11px] mt-2" style={{ color: "#525252" }}>
        支持 ¥{CUSTOM_RECHARGE_MIN_YUAN}–¥{CUSTOM_RECHARGE_MAX_YUAN} 整数金额；基础汇率 ¥1 = {PTS_PER_YUAN} pts
      </div>
    </div>
  );
}

// ─── 代理合作 ─────────────────────────────────────────────────────────────────

function AgentSection() {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "#212121", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm transition-colors duration-150"
        style={{ color: "#a3a3a3" }}
      >
        <span>代理合作 · 分成说明</span>
        <svg
          viewBox="0 0 16 16"
          className={`size-4 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: "#737373" }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 text-xs" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="pt-4" style={{ color: "#a3a3a3" }}>
            邀请用户注册并购买后，系统自动结算分润至你的钱包余额。
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="text-[10px] tracking-wide uppercase" style={{ color: "#f7931a" }}>会员订阅分成</div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span style={{ color: "#a3a3a3" }}>一级代理（直推）</span>
                  <span className="font-bold" style={{ color: "#f7931a" }}>20%</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "#a3a3a3" }}>二级代理</span>
                  <span className="font-bold" style={{ color: "#f7931a" }}>10%</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] tracking-wide uppercase" style={{ color: "#10a37f" }}>算力点充值分成</div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span style={{ color: "#a3a3a3" }}>一级代理（直推）</span>
                  <span className="font-bold" style={{ color: "#10a37f" }}>10%</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "#a3a3a3" }}>二级代理</span>
                  <span className="font-bold" style={{ color: "#10a37f" }}>5%</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ color: "#525252" }}>
            算力点直接对应模型成本，分成比例低于会员订阅。分润实时到账，可在个人中心查看明细。
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 通用组件 ─────────────────────────────────────────────────────────────────

function FeatureRow({ text, gold, purple }: { text: string; gold?: boolean; purple?: boolean }) {
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className="mt-0.5 shrink-0"
        style={{ color: gold ? "#f7931a" : purple ? "#a855f7" : "#737373" }}
      >
        ✓
      </span>
      <span style={{ color: gold || purple ? "#d4d4d4" : "#a3a3a3" }}>{text}</span>
    </li>
  );
}
