"use client";
import { useEffect, useState } from "react";
import {
  SIGNUP_BONUS_PTS,
  INVITER_BONUS_PTS,
  COST_TEXT_PT,
} from "@/lib/pricing";

type Stats = {
  walletBalanceCny: string;
  todaySumCny: string;
  totalNodes: number;
  directSubs: number;
};

type FeedEntry = {
  id: string;
  payerNickname: string;
  payerId: string;
  level: number;
  amountCny: string;
  orderAmountCny: string;
  itemCode: string;
  note: string | null;
  createdAt: string;
};

export function AgentClient({
  me,
  stats,
  feed,
}: {
  me: { nickname: string; walletBalanceCny: string };
  stats: Stats;
  feed: FeedEntry[];
}) {
  return (
    <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
      <TopBar nickname={me.nickname} />
      <StatsRow stats={stats} />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
        <SettlementFeed feed={feed} />
        <SidePanels nickname={me.nickname} />
      </div>
    </div>
  );
}

function TopBar({ nickname }: { nickname: string }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-md bg-bg-card border border-bg-edge grid place-items-center">
          <UsersIcon />
        </div>
        <div>
          <div className="text-[10px] tracking-widest uppercase text-ink-dim">CURRENT_NODE</div>
          <div className="text-ink-bright text-sm font-bold">{nickname}</div>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => alert("历史账单导出功能将在 V2 上线（含 CSV/Excel 导出）")}
          className="btn-ghost text-xs"
        >
          <DownloadIcon /> 历史账单导出
        </button>
        <button
          onClick={() => alert("提现申请将在接通法人结算后开放")}
          className="btn-primary text-xs bg-accent-neon/15 border-accent-neon/40 text-accent-neon hover:bg-accent-neon/25"
        >
          <CashIcon /> 发起结算提现
        </button>
      </div>
    </div>
  );
}

function StatsRow({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="可结算余额 (USDT EQUIV)"
        value={`¥${stats.walletBalanceCny}`}
        accent="text-ink-bright"
        icon={<WalletIcon />}
      />
      <StatCard
        label="今日预估分润 (TODAY)"
        value={`+¥${stats.todaySumCny}`}
        accent="text-accent-neon"
        icon={<TrendIcon />}
      />
      <StatCard
        label="全网链接节点 (NODES)"
        value={stats.totalNodes.toLocaleString()}
        accent="text-accent-purple"
        icon={<NetworkIcon />}
      />
      <StatCard
        label="活跃下级架构 (SUBS)"
        value={stats.directSubs.toLocaleString()}
        accent="text-accent-info"
        icon={<BoltIcon />}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="terminal-card p-4 relative overflow-hidden">
      <div className="absolute right-3 top-3 opacity-20">{icon}</div>
      <div className="text-[10px] tracking-widest uppercase text-ink-dim">{label}</div>
      <div className={`mt-2 text-2xl font-light ${accent}`}>{value}</div>
    </div>
  );
}

function SettlementFeed({ feed }: { feed: FeedEntry[] }) {
  return (
    <div className="terminal-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-bg-edge">
        <div className="flex items-center gap-2">
          <span className="size-1.5 bg-accent-neon rounded-full animate-pulseLine" />
          <span className="text-xs tracking-widest uppercase text-ink-base">
            实时结算脉冲流 (SETTLEMENT_FEED)
          </span>
        </div>
        <span className="text-[10px] text-accent-neon">系统自动暖机中</span>
      </div>
      {feed.length === 0 ? (
        <EmptyFeed />
      ) : (
        <div className="divide-y divide-bg-edge">
          {feed.map((e) => (
            <FeedRow key={e.id} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedRow({ entry }: { entry: FeedEntry }) {
  const isDirect = entry.level === 1;
  return (
    <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-[120px_1fr_220px] items-center gap-4">
      <div className="size-10 rounded-md bg-bg-card border border-bg-edge grid place-items-center text-ink-muted text-[10px] tracking-widest">
        {isDirect ? "L1" : "L2"}
      </div>

      <div className="space-y-1.5">
        <div className="text-ink-bright text-sm">
          分润收益到账通知{" "}
          <span className="text-[10px] text-ink-dim ml-1">
            {new Date(entry.createdAt).toLocaleString("zh-CN", {
              hour12: false,
            })}
          </span>
        </div>
        <div className="text-[11px] text-ink-muted leading-relaxed">
          充值用户 <span className="text-ink-base font-bold">{entry.payerNickname}</span>{" "}
          <span className="text-ink-dim">(ID: {entry.payerId.slice(-7)})</span>
          {" · "}
          <span className={isDirect ? "text-accent-info" : "text-accent-purple"}>
            {isDirect ? "直属用户" : "二级代理"}
          </span>
          {" · "}充值 ¥{entry.orderAmountCny} ({entry.itemCode})
        </div>
        {entry.note && (
          <div className="text-[10px] text-ink-dim italic">{entry.note}</div>
        )}
      </div>

      <div className="space-y-1 md:text-right">
        <div className="text-[10px] tracking-widest uppercase text-ink-dim">您的分润</div>
        <div className="text-accent-neon text-xl">+¥{entry.amountCny}</div>
        <div className="text-[10px] text-accent-neon/70">分润已自动结算到您的可提现余额</div>
      </div>
    </div>
  );
}

function EmptyFeed() {
  return (
    <div className="px-5 py-12 text-center space-y-2">
      <div className="text-ink-muted text-sm">暂无分润记录</div>
      <div className="text-[11px] text-ink-dim">
        当下级用户充值或购买 VIP 时，分润会自动到账并显示在此处
      </div>
    </div>
  );
}

function SidePanels({ nickname }: { nickname: string }) {
  return (
    <div className="space-y-4">
      <InvitePanel nickname={nickname} />
      <SiteEnvPanel />
      <NetworkPanel />
    </div>
  );
}

function InvitePanel({ nickname }: { nickname: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<"link" | "template" | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const url = origin ? `${origin}/register?ref=${encodeURIComponent(nickname)}` : "";
  const template = url
    ? `🚀 我在用「彭哥 AI 交易终端」做交易决策辅助，PG 系列推理引擎 + SMC/ICT 框架，覆盖外汇/黄金/加密/美股/A股 5 大频道。

通过我的链接注册：
${url}

✅ 立即赠 ${SIGNUP_BONUS_PTS.toLocaleString()} 算力点（约 ${Math.floor(SIGNUP_BONUS_PTS / COST_TEXT_PT)} 次完整推理）
✅ 用我的邀请码后我也能拿 ${INVITER_BONUS_PTS}pt 奖励
✅ 你后续充值/订阅，我可获返佣，等于双方共赢`
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
    <div className="terminal-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="size-1.5 bg-accent-razer rounded-full animate-pulseLine" />
        <span className="text-[10px] tracking-widest uppercase text-ink-base">
          专属邀请链接 (REFERRAL_LINK)
        </span>
      </div>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full bg-bg-card border border-bg-edge rounded-md px-2 py-1.5 text-[11px] text-ink-bright outline-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => copy(url, "link")}
          className="btn-ghost text-xs"
        >
          {copied === "link" ? "✓ 已复制" : "仅复制链接"}
        </button>
        <button
          onClick={() => copy(template, "template")}
          className="btn-primary text-xs"
        >
          {copied === "template" ? "✓ 已复制" : "复制 + 推广话术"}
        </button>
      </div>
      <div className="text-[10px] text-ink-dim leading-relaxed">
        新用户通过此链接注册，自动成为您的直推；其充值将按 20% / 10% 派发分润，且您可即时获 +200 算力点奖励。
      </div>
    </div>
  );
}

function SiteEnvPanel() {
  return (
    <div className="terminal-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="size-1.5 bg-accent-gold rounded-full" />
        <span className="text-[10px] tracking-widest uppercase text-ink-base">
          站点环境变量 (BRANDING)
        </span>
      </div>
      <div>
        <div className="label-tag mb-1">LOGO_ENV</div>
        <button
          onClick={() => alert("LOGO 自定义上传将在白标系统上线后开放")}
          className="w-full terminal-card px-3 py-2 flex items-center justify-between hover:border-accent-info/40 transition-colors"
        >
          <span className="text-xs text-ink-base">PENG_GE_V4_DARK.png</span>
          <span className="text-[10px] text-accent-info">UPLOAD</span>
        </button>
      </div>
      <div>
        <div className="label-tag mb-1">TERMINAL_NAME</div>
        <input
          readOnly
          value="彭哥智能交易站 [NODE_A01]"
          className="w-full bg-bg-card border border-bg-edge rounded-md px-2 py-1.5 text-xs text-ink-bright outline-none"
        />
      </div>
      <div className="text-[10px] text-ink-dim border-t border-bg-edge pt-2 leading-relaxed">
        ⚠ 修改环境变量将影响所有下级节点，本期仅展示，正式开放需联系运营。
      </div>
    </div>
  );
}

function NetworkPanel() {
  return (
    <div className="terminal-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="size-1.5 bg-accent-purple rounded-full" />
        <span className="text-[10px] tracking-widest uppercase text-ink-base">
          分销网络生态
        </span>
      </div>
      <button
        onClick={() => alert("二级运营节点招募流程待运营审核机制上线")}
        className="w-full border-2 border-dashed border-bg-edge rounded-md py-6 grid place-items-center gap-2 hover:border-accent-purple/60 transition-colors"
      >
        <span className="text-3xl text-ink-dim">+</span>
        <span className="text-xs text-ink-muted">招募二级运营节点</span>
        <span className="text-[10px] text-ink-dim">生成监管协议、扩充资产管理网络</span>
      </button>
    </div>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4 text-ink-base" fill="currentColor">
      <circle cx="6" cy="5" r="2.5" />
      <circle cx="12" cy="6" r="2" />
      <path d="M2 13c0-2 2-3.5 4-3.5s4 1.5 4 3.5v1H2zM10 14v-1c0-1.2-.5-2.2-1.4-2.9.5-.1.9-.1 1.4-.1 2 0 4 1.5 4 3.5v.5z" />
    </svg>
  );
}
function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2v9M4 7l4 4 4-4M2 14h12" />
    </svg>
  );
}
function CashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="4" width="12" height="8" rx="1" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}
function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <circle cx="17" cy="12.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
function TrendIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M3 17l6-6 4 4 7-9" />
      <path d="M14 6h6v6" />
    </svg>
  );
}
function NetworkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="1.2">
      <circle cx="12" cy="5" r="2" />
      <circle cx="5" cy="19" r="2" />
      <circle cx="19" cy="19" r="2" />
      <path d="M12 7v4M12 11l-7 6M12 11l7 6" />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-8" fill="currentColor">
      <path d="M14 2L4 14h6l-1 8 10-12h-6l1-8z" />
    </svg>
  );
}
