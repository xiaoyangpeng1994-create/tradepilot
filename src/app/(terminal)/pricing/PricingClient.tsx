"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { fenToYuan, ItemCode } from "@/lib/pricing";

type Initial = {
  isLoggedIn: boolean;
  nickname: string | null;
  computePts: number;
  vipLevel: string;
  vipExpiresAt: string | null;
};

export function PricingClient({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [tab, setTab] = useState<"VIP" | "PTS">("VIP");
  const [buying, setBuying] = useState<ItemCode | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const isVipActive =
    initial.vipLevel !== "FREE" &&
    (!initial.vipExpiresAt || new Date(initial.vipExpiresAt).getTime() > Date.now());

  async function buy(itemCode: ItemCode, label: string) {
    if (!initial.isLoggedIn) {
      setToast({ kind: "err", text: "请先登录后再购买" });
      return;
    }
    if (!confirm(`确认购买「${label}」？开发模式将立即模拟支付完成。`)) return;
    setBuying(itemCode);
    setToast(null);
    try {
      const res = await fetch("/api/order/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemCode }),
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

function VipPanel({
  buying,
  onBuy,
}: {
  buying: ItemCode | null;
  onBuy: (code: ItemCode, label: string) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="size-14 rounded-md bg-gradient-to-br from-accent-gold to-amber-700 grid place-items-center glow-edge">
          <CrownIcon />
        </div>
        <div>
          <div className="text-accent-gold text-xl font-bold tracking-wider">PREMIUM_PRO_LEVEL</div>
          <div className="text-[10px] tracking-[0.3em] text-ink-dim uppercase">
            INSTITUTIONAL ACCESS UNLOCKED
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Feature title="无限深度扫描" desc="解除 Token 消耗限制，支持 24/7 全天候实时分析。" iconBg="bg-accent-info/15" icon={<BoltIcon />} />
        <Feature title="加密推送频道" desc="优先接入全球大行机构订单流推送，先人一步发觉趋势。" iconBg="bg-accent-purple/15" icon={<RadarIcon />} />
        <Feature title="风控大师工具" desc="解锁全功能仓位计算器与多周期共振演算矩阵。" iconBg="bg-accent-neon/15" icon={<ShieldIcon />} />
        <Feature title="专属策略订阅" desc="每日推送高盈亏比 SMC/ICT 交易架构模板。" iconBg="bg-accent-gold/15" icon={<TargetIcon />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        <PriceCard
          title="月度专业版"
          price="¥599"
          unit="/月"
          desc="灵活试用，按月续费"
          buying={buying === "PRO_MONTH"}
          onBuy={() => onBuy("PRO_MONTH", "月度专业版 ¥599/月")}
        />
        <PriceCard
          title="年度旗舰版"
          price="¥4,999"
          unit="/年"
          desc="折合 ¥416/月，省 ¥2,189"
          highlight
          badge="YEARLY_PRO_SAVINGS"
          buying={buying === "PRO_YEAR"}
          onBuy={() => onBuy("PRO_YEAR", "年度旗舰版 ¥4,999/年")}
        />
      </div>
    </div>
  );
}

function PtsPanel({
  buying,
  onBuy,
}: {
  buying: ItemCode | null;
  onBuy: (code: ItemCode, label: string) => void;
}) {
  const packs: Array<{ code: ItemCode; pts: number; price: number; tag?: string }> = [
    { code: "PTS_500", pts: 500, price: 1000 },
    { code: "PTS_2000", pts: 2000, price: 3500, tag: "性价比" },
    { code: "PTS_5000", pts: 5000, price: 8000, tag: "推荐" },
    { code: "PTS_20000", pts: 20000, price: 29900, tag: "大额优惠" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="text-ink-bright text-base font-bold tracking-wide">算力点数（pts）</div>
        <div className="text-xs text-ink-muted mt-1">
          1 次文本对话消耗 1 pt；上传 K 线图深度推理消耗 5 pts。VIP 用户不消耗算力。
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {packs.map((p) => {
          const yuanPerPt = p.price / 100 / p.pts;
          return (
            <div
              key={p.code}
              className="terminal-card p-4 flex flex-col gap-3 hover:border-accent-info/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="text-accent-neon text-xl font-light">
                  {p.pts.toLocaleString()}
                </div>
                {p.tag && (
                  <span className="text-[9px] tracking-widest text-accent-gold border border-accent-gold/40 rounded-sm px-1.5 py-0.5">
                    {p.tag}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-ink-dim">
                ≈ ¥{yuanPerPt.toFixed(3)} / pt
              </div>
              <div className="text-ink-bright text-2xl font-bold">¥{fenToYuan(p.price)}</div>
              <button
                disabled={buying === p.code}
                onClick={() => onBuy(p.code, `${p.pts.toLocaleString()} 算力点 ¥${fenToYuan(p.price)}`)}
                className="btn-primary mt-auto disabled:opacity-50"
              >
                {buying === p.code ? "处理中..." : "立即充值"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Feature({
  title,
  desc,
  iconBg,
  icon,
}: {
  title: string;
  desc: string;
  iconBg: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="terminal-card p-4 flex gap-3">
      <div className={`size-9 shrink-0 rounded-md grid place-items-center ${iconBg}`}>{icon}</div>
      <div>
        <div className="text-ink-bright text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-ink-muted mt-1 leading-relaxed">{desc}</div>
      </div>
    </div>
  );
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
}: {
  title: string;
  price: string;
  unit: string;
  desc: string;
  highlight?: boolean;
  badge?: string;
  buying: boolean;
  onBuy: () => void;
}) {
  return (
    <div
      className={`terminal-card p-6 relative ${
        highlight ? "border-accent-gold/60 glow-edge" : ""
      }`}
    >
      {badge && (
        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] tracking-widest bg-accent-gold/20 text-accent-gold border border-accent-gold/60 rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
      <div className="text-center space-y-3">
        <div className={`text-sm tracking-widest ${highlight ? "text-accent-gold" : "text-ink-muted"}`}>
          {title}
        </div>
        <div className="flex items-baseline justify-center gap-1">
          <span className={`text-4xl font-bold ${highlight ? "text-accent-gold" : "text-ink-bright"}`}>
            {price}
          </span>
          <span className="text-ink-dim text-sm">{unit}</span>
        </div>
        <div className="text-[11px] text-ink-muted">{desc}</div>
        <button
          disabled={buying}
          onClick={onBuy}
          className={`w-full disabled:opacity-50 ${highlight ? "btn-gold" : "btn-primary"}`}
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
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-accent-info" fill="currentColor">
      <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" />
    </svg>
  );
}
function RadarIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-accent-purple" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="3" />
      <path d="M8 8L13 3" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-accent-neon" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1l6 2v5c0 4-3 6.5-6 7-3-.5-6-3-6-7V3l6-2z" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-accent-gold" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}
