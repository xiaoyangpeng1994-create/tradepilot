"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import {
  fenToYuan,
  ItemCode,
  PTS_PER_YUAN,
  COST_TEXT_PT,
  COST_IMAGE_PT,
  CUSTOM_RECHARGE_MIN_YUAN,
  CUSTOM_RECHARGE_MAX_YUAN,
} from "@/lib/pricing";

type Initial = {
  isLoggedIn: boolean;
  nickname: string | null;
  computePts: number;
  vipLevel: string;
  vipExpiresAt: string | null;
};

type BuyPayload = { itemCode: string; customAmountYuan?: number };

export function PricingClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [tab, setTab] = useState<"VIP" | "PTS">("VIP");
  const [buying, setBuying] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const isVipActive =
    initial.vipLevel !== "FREE" &&
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
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <AccountStatus initial={initial} isVipActive={isVipActive} />

      <div className="terminal-card overflow-hidden">
        <div className="grid grid-cols-2 border-b border-bg-edge">
          <TabButton active={tab === "VIP"} onClick={() => setTab("VIP")}>
            VIP 订阅服务
          </TabButton>
          <TabButton active={tab === "PTS"} onClick={() => setTab("PTS")}>
            算力点数充值
          </TabButton>
        </div>
        <div className="p-6">
          {tab === "VIP" ? (
            <VipPanel buying={buying} onBuy={buy} />
          ) : (
            <PtsPanel buying={buying} onBuy={buy} />
          )}
        </div>
      </div>

      <div className="text-[10px] text-ink-dim leading-relaxed">
        当前为开发模式：点击购买后系统会立即模拟支付完成，自动结算上下游分润；正式版将接入支付网关 + 异步回调。
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md text-xs border ${
            toast.kind === "ok"
              ? "border-accent-neon/50 bg-accent-neon/15 text-accent-neon"
              : "border-accent-danger/50 bg-accent-danger/15 text-accent-danger"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function AccountStatus({ initial, isVipActive }: { initial: Initial; isVipActive: boolean }) {
  if (!initial.isLoggedIn) {
    return (
      <div className="terminal-card p-4 flex items-center justify-between">
        <div className="text-sm text-ink-muted">购买前请先登录账号。</div>
        <Link href="/login?callbackUrl=/pricing" className="btn-primary">
          去登录
        </Link>
      </div>
    );
  }
  return (
    <div className="terminal-card p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-6 text-xs">
        <div>
          <div className="label-tag">当前节点</div>
          <div className="text-ink-bright text-sm">{initial.nickname}</div>
        </div>
        <div>
          <div className="label-tag">算力余额</div>
          <div className="text-accent-neon text-sm">
            {initial.computePts.toLocaleString()} <span className="text-ink-dim">pts</span>
          </div>
        </div>
        <div>
          <div className="label-tag">VIP 等级</div>
          <div className={isVipActive ? "text-accent-gold text-sm" : "text-ink-muted text-sm"}>
            {isVipActive ? initial.vipLevel : "FREE"}
            {isVipActive && initial.vipExpiresAt && (
              <span className="text-[10px] text-ink-dim ml-2">
                到期 {new Date(initial.vipExpiresAt).toLocaleDateString("zh-CN")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-3 text-sm tracking-wide transition-colors ${
        active
          ? "text-accent-gold border-b-2 border-accent-gold bg-bg-card/40"
          : "text-ink-muted hover:text-ink-base"
      }`}
    >
      {children}
    </button>
  );
}

function VipRoiCalc() {
  const [perDay, setPerDay] = useState(10);
  const monthlyPts = perDay * COST_TEXT_PT * 30;
  const equivYuan = Math.ceil(monthlyPts / PTS_PER_YUAN);
  const vipBeats = equivYuan >= 599;
  const perCallYuan = (COST_TEXT_PT / PTS_PER_YUAN).toFixed(2);

  return (
    <div className="terminal-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="size-1.5 bg-accent-razer rounded-full animate-pulseLine" />
        <span className="text-[10px] tracking-widest uppercase text-ink-base">
          VIP 性价比测算 (ROI_CALCULATOR)
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-ink-muted">假设你每天进行</span>
        <input
          type="range"
          min={1}
          max={50}
          value={perDay}
          onChange={(e) => setPerDay(Number(e.target.value))}
          className="flex-1 min-w-[140px] accent-accent-razer"
        />
        <span className="text-accent-razer text-base font-bold">{perDay}</span>
        <span className="text-xs text-ink-muted">次文本对话</span>
      </div>
      <div className="text-xs text-ink-base leading-relaxed">
        单次文本约 <span className="text-accent-razer font-bold">¥{perCallYuan}</span>，每月预计消耗{" "}
        <span className="text-accent-razer font-bold">{monthlyPts.toLocaleString()} pts</span>
        ，等价充值 <span className="text-accent-razer font-bold">¥{equivYuan}</span>
        ；月度 VIP 仅 ¥599 含
        <span className="text-accent-gold"> 加密推送 / 策略订阅 / 风控工具</span>{" "}
        等独家功能。
      </div>
      <div
        className={`text-xs px-3 py-2 rounded border ${
          vipBeats
            ? "border-accent-razer/50 bg-accent-razer/10 text-accent-razer"
            : "border-bg-edge bg-bg-card/50 text-ink-muted"
        }`}
      >
        {vipBeats
          ? `✓ 你的使用强度下，VIP 已比充值更划算（省 ¥${equivYuan - 599} + 解锁全部特权）`
          : `💡 当前频次充值更便宜；但若加上 K 线深度分析（${COST_IMAGE_PT} pt/次）或更密集对话，VIP 立刻回本`}
      </div>
    </div>
  );
}

function VipPanel({
  buying,
  onBuy,
}: {
  buying: string | null;
  onBuy: (payload: BuyPayload, label: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="terminal-card p-5 border-accent-gold/40 bg-gradient-to-br from-accent-gold/5 via-bg-panel to-transparent space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-md bg-gradient-to-br from-accent-gold to-amber-700 grid place-items-center glow-edge shrink-0">
            <CrownIcon />
          </div>
          <div>
            <div className="text-accent-gold text-lg font-bold tracking-wider flex items-center gap-2">
              VIP · 月度专业版
              <span className="text-[10px] tracking-widest text-accent-gold px-1.5 py-0.5 rounded bg-accent-gold/15 border border-accent-gold/40">
                FOR ACTIVE TRADERS
              </span>
            </div>
            <div className="text-[10px] tracking-[0.3em] text-ink-dim uppercase">
              INSTITUTIONAL ACCESS · ¥599/月
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <TierFeature label="🚀 PG-MAX 旗舰推理引擎" desc="vs 免费档 PG-CORE，更深度上下文 + 更长推理空间，回答质量翻番" />
          <TierFeature label="📚 5 段深度报告模板" desc="每次回答按机构研报标准结构化输出，含三档情景预案" />
          <TierFeature label="∞ 不限算力消耗" desc={`VIP 期间所有对话与图片分析全免费，告别 ${COST_TEXT_PT} pt/次`} />
          <TierFeature label="🎯 多周期 4H + 1H 联动" desc="主结构 + 入场点同时分析，覆盖 SMC 多级共振" />
          <TierFeature label="📊 完整交易档案保留" desc="个性化档案永久沉淀（vs 免费档 90 天清理）" />
          <TierFeature label="🛡️ 优先客服响应" desc="VIP 专属通道，问题 24h 内响应" />
        </div>
      </div>

      <VipRoiCalc />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <PriceCard
          title="月度专业版"
          price="¥599"
          unit="/月"
          desc="灵活试用，按月续费"
          buying={buying === "PRO_MONTH"}
          onBuy={() => onBuy({ itemCode: "PRO_MONTH" }, "月度专业版 ¥599/月")}
        />
        <PriceCard
          title="年度旗舰版"
          price="¥4,999"
          unit="/年"
          desc="折合 ¥416/月，省 ¥2,189"
          highlight
          badge="YEARLY_PRO_SAVINGS"
          buying={buying === "PRO_YEAR"}
          onBuy={() => onBuy({ itemCode: "PRO_YEAR" }, "年度旗舰版 ¥4,999/年")}
        />
      </div>

      <UltraSection buying={buying} onBuy={onBuy} />
    </div>
  );
}

function UltraSection({
  buying,
  onBuy,
}: {
  buying: string | null;
  onBuy: (payload: BuyPayload, label: string) => void;
}) {
  return (
    <div className="terminal-card p-5 border-accent-purple/40 bg-gradient-to-br from-accent-purple/5 via-bg-panel to-accent-gold/5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-md bg-gradient-to-br from-accent-purple to-amber-600 grid place-items-center razer-glow">
          <span className="text-base font-black text-bg-base">⚡</span>
        </div>
        <div>
          <div className="text-accent-gold text-lg font-bold tracking-wider flex items-center gap-2">
            ULTRA · 旗舰旗舰版 <span className="text-[10px] tracking-widest text-accent-purple px-1.5 py-0.5 rounded bg-accent-purple/15 border border-accent-purple/40">FOR PROS</span>
          </div>
          <div className="text-[10px] tracking-[0.3em] text-ink-dim uppercase">
            FOR HEAVY TRADERS · ¥1,999/月
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
        <TierFeature label="📊 月度交易复盘 PDF" desc="2000+ 字 AI 自动研报，分析当月所有交易 + 进步退步对照" />
        <TierFeature label="🔔 持仓守护实时推送" desc="后台扫描 K 线，关键位触发主动微信推送（即将上线）" />
        <TierFeature label="👑 ULTRA 专属社群" desc="私域微信群 + 每周分享会，与彭哥团队 1v1 答疑" />
        <TierFeature label="🧠 多周期联动" desc="4H + 1H + 15m 三周期同时分析，覆盖入场-管理-出场全程" />
        <TierFeature label="📡 链上 / 大单数据" desc="接入 Whale Alert / 大资金流监测（即将上线）" />
        <TierFeature label="⚡ PG-ULTRA 引擎角标" desc="AI 回复带专属 ⚡ ULTRA 标识，对话深度上限提升 50%" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        <PriceCard
          title="ULTRA 月度版"
          price="¥1,999"
          unit="/月"
          desc="按月开通，随时取消"
          ultra
          buying={buying === "PRO_PLUS_MONTH"}
          onBuy={() => onBuy({ itemCode: "PRO_PLUS_MONTH" }, "ULTRA 月度版 ¥1,999/月")}
        />
        <PriceCard
          title="ULTRA 年度版"
          price="¥17,999"
          unit="/年"
          desc="折合 ¥1,499/月，省 ¥6,000"
          ultra
          highlight
          badge="ULTRA_BEST_VALUE"
          buying={buying === "PRO_PLUS_YEAR"}
          onBuy={() => onBuy({ itemCode: "PRO_PLUS_YEAR" }, "ULTRA 年度版 ¥17,999/年")}
        />
      </div>

      <div className="text-[10px] text-ink-dim leading-relaxed">
        ⚠️ ULTRA 是为日均 30+ 笔分析、严肃职业交易者准备的旗舰档；普通用户 VIP 即足够。功能将在购买后陆续上线，所有 ULTRA 用户终身锁定首发权益。
      </div>
    </div>
  );
}

function TierFeature({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="border border-bg-edge bg-bg-card/40 rounded-md p-2.5">
      <div className="text-ink-bright font-bold text-[12px] mb-1">{label}</div>
      <div className="text-ink-muted text-[11px] leading-relaxed">{desc}</div>
    </div>
  );
}

function PtsPanel({
  buying,
  onBuy,
}: {
  buying: string | null;
  onBuy: (payload: BuyPayload, label: string) => void;
}) {
  const fixedYuan = [50, 100, 300, 500, 1000];

  return (
    <div className="space-y-5">
      <div>
        <div className="text-ink-bright text-base font-bold tracking-wide">算力点数（pts）</div>
        <div className="text-xs text-ink-muted mt-1">
          ¥1 = {PTS_PER_YUAN} pts；1 次文本对话消耗 {COST_TEXT_PT} pt（约 ¥
          {(COST_TEXT_PT / PTS_PER_YUAN).toFixed(2)}/次），上传 K 线图深度推理消耗 {COST_IMAGE_PT} pts（约 ¥
          {(COST_IMAGE_PT / PTS_PER_YUAN).toFixed(2)}/次）。VIP 用户不消耗算力。
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {fixedYuan.map((yuan) => {
          const code = `PTS_${yuan}` as ItemCode;
          const pts = yuan * PTS_PER_YUAN;
          const isBuying = buying === code;
          return (
            <div
              key={code}
              className="terminal-card p-4 flex flex-col gap-2 hover:border-accent-info/40 transition-colors"
            >
              <div className="text-ink-bright text-2xl font-bold">¥{yuan}</div>
              <div className="text-[11px] text-accent-neon">
                {pts.toLocaleString()} pts
              </div>
              <button
                disabled={isBuying}
                onClick={() => onBuy({ itemCode: code }, `¥${yuan} → ${pts.toLocaleString()} pts`)}
                className="btn-primary mt-auto disabled:opacity-50 text-xs"
              >
                {isBuying ? "处理中..." : "立即充值"}
              </button>
            </div>
          );
        })}
      </div>

      <CustomRecharge buying={buying} onBuy={onBuy} />
    </div>
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
    <div className="terminal-card p-4 border-accent-info/20">
      <div className="flex items-center gap-2 mb-3">
        <span className="size-1.5 bg-accent-info rounded-full animate-pulseLine" />
        <span className="text-[10px] tracking-widest uppercase text-ink-base">
          自定义金额 (CUSTOM_RECHARGE)
        </span>
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <div className="label-tag mb-1">充值金额（元）</div>
          <div className="flex items-center bg-bg-card border border-bg-edge rounded-md px-3 py-2 focus-within:border-accent-info/60">
            <span className="text-ink-dim text-sm mr-2">¥</span>
            <input
              type="number"
              inputMode="numeric"
              min={CUSTOM_RECHARGE_MIN_YUAN}
              max={CUSTOM_RECHARGE_MAX_YUAN}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${CUSTOM_RECHARGE_MIN_YUAN}-${CUSTOM_RECHARGE_MAX_YUAN}`}
              className="flex-1 bg-transparent outline-none text-ink-bright text-sm"
            />
          </div>
        </div>
        <div className="min-w-[140px]">
          <div className="label-tag mb-1">将获得</div>
          <div className="text-accent-neon text-lg font-bold">
            {valid ? pts.toLocaleString() : "—"}{" "}
            <span className="text-[10px] text-ink-dim font-normal">pts</span>
          </div>
        </div>
        <button
          disabled={!valid || isBuying}
          onClick={() =>
            onBuy(
              { itemCode: "PTS_CUSTOM", customAmountYuan: yuan },
              `自定义充值 ¥${yuan} → ${pts.toLocaleString()} pts`,
            )
          }
          className="btn-primary text-xs disabled:opacity-50"
        >
          {isBuying ? "处理中..." : "立即充值"}
        </button>
      </div>
      <div className="text-[10px] text-ink-dim mt-2">
        支持 ¥{CUSTOM_RECHARGE_MIN_YUAN}-¥{CUSTOM_RECHARGE_MAX_YUAN} 整数金额；当前汇率 ¥1 = {PTS_PER_YUAN} pts。
      </div>
    </div>
  );
}

function Feature(_props: { title: string; desc: string; iconBg: string; icon: React.ReactNode }) {
  // 留壳 — 之前 4 色彩虹图标 Feature 已被 TierFeature 取代，此处仅占位防止外部引用碎裂
  void _props;
  return null;
}

function PriceCard({
  title,
  price,
  unit,
  desc,
  highlight,
  badge,
  buying,
  onBuy,
  ultra,
}: {
  title: string;
  price: string;
  unit: string;
  desc: string;
  highlight?: boolean;
  badge?: string;
  buying: boolean;
  onBuy: () => void;
  ultra?: boolean;
}) {
  // ULTRA 档配色用紫色，普通 highlight 用金色（必须用字面量 class，Tailwind JIT 不识别动态拼接）
  return (
    <div
      className={`terminal-card p-6 relative ${
        highlight && ultra
          ? "border-accent-purple/60 glow-edge bg-accent-purple/5"
          : highlight
            ? "border-accent-gold/60 glow-edge"
            : ultra
              ? "bg-accent-purple/5"
              : ""
      }`}
    >
      {badge && (
        <span
          className={`absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] tracking-widest border rounded-full px-2 py-0.5 ${
            ultra
              ? "bg-accent-purple/20 text-accent-purple border-accent-purple/60"
              : "bg-accent-gold/20 text-accent-gold border-accent-gold/60"
          }`}
        >
          {badge}
        </span>
      )}
      <div className="text-center space-y-3">
        <div
          className={`text-sm tracking-widest ${
            highlight && ultra
              ? "text-accent-purple"
              : highlight
                ? "text-accent-gold"
                : ultra
                  ? "text-accent-purple"
                  : "text-ink-muted"
          }`}
        >
          {title}
        </div>
        <div className="flex items-baseline justify-center gap-1">
          <span
            className={`text-4xl font-bold ${
              highlight && ultra
                ? "text-accent-purple"
                : highlight
                  ? "text-accent-gold"
                  : ultra
                    ? "text-accent-purple"
                    : "text-ink-bright"
            }`}
          >
            {price}
          </span>
          <span className="text-ink-dim text-sm">{unit}</span>
        </div>
        <div className="text-[11px] text-ink-muted">{desc}</div>
        <button
          disabled={buying}
          onClick={onBuy}
          className={`w-full disabled:opacity-50 ${
            ultra ? "btn-primary" : highlight ? "btn-gold" : "btn-primary"
          }`}
        >
          {buying ? "处理中..." : "立即开通"}
        </button>
      </div>
    </div>
  );
}

function CrownIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-7 text-bg-base" fill="currentColor">
      <path d="M3 8l4 5 5-7 5 7 4-5-2 11H5L3 8z" />
    </svg>
  );
}
function BoltIcon() {
  return null;
}
function RadarIcon() {
  return null;
}
function ShieldIcon() {
  return null;
}
function TargetIcon() {
  return null;
}
