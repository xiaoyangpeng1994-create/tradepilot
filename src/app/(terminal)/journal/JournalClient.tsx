"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { isPaidLevel, isUltraLevel } from "@/lib/pricing";

type Direction = "LONG" | "SHORT";
type Status = "OPEN" | "CLOSED";

type Trade = {
  id: string;
  symbol: string;
  channel: string | null;
  direction: Direction;
  entryPrice: number;
  stopPrice: number | null;
  targetPrice: number | null;
  exitPrice: number | null;
  pnlPct: number | null;
  status: Status;
  setup: string | null;
  timeframe: string | null;
  notes: string | null;
  openedAt: string;
  closedAt: string | null;
};

type Stats = {
  totalClosed: number;
  totalOpen: number;
  winRate: number;
  avgPnlPct: number;
  bestPct: number | null;
  worstPct: number | null;
  bySetup: Array<{ setup: string; count: number; winRate: number; avgPnlPct: number }>;
  bySymbol: Array<{ symbol: string; count: number; winRate: number; avgPnlPct: number }>;
  // 新增画像字段
  avgHoldHours: number | null;
  longRatioPct: number | null;
  recentMoodPct: number | null;
  recentWinRate: number | null;
  stopLossRatePct: number | null;
  topTimeframe: string | null;
  profileCompletion: number;
  profileCompletionLabel: string;
};

const SETUP_OPTIONS = [
  "OB 回踩",
  "FVG 填补",
  "流动性扫损",
  "MSB / CHoCH",
  "突破回踩",
  "趋势延续",
  "区间反转",
  "其他",
];
const TIMEFRAMES = ["15m", "1h", "4h", "1d", "weekly"];

export function JournalClient() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch("/api/trades"),
        fetch("/api/trades/stats"),
      ]);
      const tData = await tRes.json();
      const sData = await sRes.json();
      setTrades(tData.trades ?? []);
      setStats(sData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  const { data: session } = useSession();
  const vipLevel = (session?.user as { vipLevel?: string } | undefined)?.vipLevel ?? "FREE";
  const isPaid = isPaidLevel(vipLevel);
  const isUltra = isUltraLevel(vipLevel);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <ProfileHero />

      {/* 画像完成度进度条 */}
      <ProfileCompletionBar stats={stats} loading={loading} />

      {/* AI 观察卡 */}
      <AIObservationCard stats={stats} loading={loading} isPaid={isPaid} />

      {/* 最近 5 笔复盘入口 */}
      <RecentTradesReview trades={trades} isPaid={isPaid} />

      <ProfileSummaryCard stats={stats} loading={loading} />
      <StatsPanel stats={stats} loading={loading} />
      <ReviewCta hasData={!!stats && stats.totalClosed >= 3} />

      <div className="flex items-center justify-between pt-2">
        <span className="text-[11px] tracking-wide text-ink-muted">
          最近交易记录 · {trades.length} 条
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary text-xs"
        >
          {showForm ? "取消" : "+ 新增交易"}
        </button>
      </div>

      {showForm && <NewTradeForm onSaved={() => { setShowForm(false); reload(); }} />}

      <TradeTable trades={trades} onChanged={reload} />
    </div>
  );
}

function ProfileHero() {
  return (
    <div className="rounded-xl border border-white/[0.04] bg-bg-panel/40 backdrop-blur-sm shadow-soft px-5 py-4">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="size-1.5 rounded-full bg-accent-razer animate-pulseLine shadow-[0_0_8px_rgba(68,214,44,0.6)]" />
        <span className="text-[10px] tracking-[0.18em] uppercase text-accent-razer">
          AI Trading Profile
        </span>
      </div>
      <p className="text-sm text-ink-base leading-relaxed">
        每一笔复盘，都会让 TradePilot 更懂你的交易习惯。
        <span className="text-ink-muted">
          {" "}记录越多，AI 越能识别你的优势 setup 与风险盲点。
        </span>
      </p>
    </div>
  );
}

function ProfileSummaryCard({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading) return null;
  const totalClosed = stats?.totalClosed ?? 0;
  const totalOpen = stats?.totalOpen ?? 0;

  // 数据不足 (<3 笔已平仓) → 引导用户记满 3 笔
  if (totalClosed < 3) {
    const remaining = 3 - totalClosed;
    return (
      <div className="rounded-xl border border-white/[0.04] bg-bg-panel/30 px-5 py-4 space-y-3">
        <div className="text-[10px] tracking-[0.18em] uppercase text-ink-dim">
          画像摘要
        </div>
        <p className="text-sm text-ink-base leading-relaxed">
          至少记录 <span className="text-accent-razer font-bold">3 笔已平仓交易</span> 后，
          AI 将开始生成你的交易画像（优势 setup / 常交易标的 / 风险盲点）。
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 rounded-full bg-bg-edge overflow-hidden">
            <div
              className="h-full bg-accent-razer transition-all"
              style={{ width: `${Math.min(100, (totalClosed / 3) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] text-ink-dim shrink-0">
            {totalClosed} / 3{" "}
            {remaining > 0 && `· 还差 ${remaining} 笔`}
          </span>
        </div>
        {totalOpen > 0 && (
          <p className="text-[11px] text-ink-muted">
            当前持仓 {totalOpen} 笔——平仓后会自动计入画像。
          </p>
        )}
      </div>
    );
  }

  // ≥3 笔：从 stats 派生洞察
  const ranked = stats!.bySetup.filter((s) => s.count >= 3);
  const best = ranked.length > 0 ? ranked.reduce((a, b) => (a.winRate > b.winRate ? a : b)) : null;
  const worst =
    ranked.length > 1
      ? ranked.reduce((a, b) => (a.winRate < b.winRate ? a : b))
      : null;
  const showWorst = worst && worst.setup !== best?.setup && worst.winRate < 40;
  const topSymbol = stats!.bySymbol[0] ?? null;

  return (
    <div className="rounded-xl border border-white/[0.04] bg-bg-panel/30 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-ink-dim">
          画像摘要
        </span>
        <span className="text-[10px] text-ink-dim">
          基于 {totalClosed} 笔已平仓交易
        </span>
      </div>
      <ul className="space-y-2 text-sm">
        {topSymbol && (
          <InsightRow
            dot="bg-accent-razer"
            label="最常交易"
            value={
              <>
                <span className="text-ink-bright font-bold">{topSymbol.symbol}</span>
                <span className="text-ink-muted ml-2 text-[11px]">
                  ×{topSymbol.count} · 胜率 {topSymbol.winRate.toFixed(0)}%
                </span>
              </>
            }
          />
        )}
        {best && (
          <InsightRow
            dot="bg-accent-razer"
            label="优势 setup"
            value={
              <>
                <span className="text-ink-bright font-bold">{best.setup}</span>
                <span className="text-ink-muted ml-2 text-[11px]">
                  ×{best.count} · 胜率 {best.winRate.toFixed(0)}%
                </span>
              </>
            }
          />
        )}
        {showWorst && worst && (
          <InsightRow
            dot="bg-accent-danger"
            label="风险盲点"
            value={
              <>
                <span className="text-ink-bright">{worst.setup}</span>
                <span className="text-ink-muted ml-2 text-[11px]">
                  ×{worst.count} · 胜率仅 {worst.winRate.toFixed(0)}% — 遇到时多等结构确认
                </span>
              </>
            }
          />
        )}
        <InsightRow
          dot="bg-ink-dim"
          label="当前持仓"
          value={
            <span className="text-ink-base">
              {totalOpen} 笔
              {totalOpen > 0 && (
                <span className="text-ink-muted ml-2 text-[11px]">
                  平仓后将更新画像
                </span>
              )}
            </span>
          }
        />
      </ul>
    </div>
  );
}

function InsightRow({
  dot,
  label,
  value,
}: {
  dot: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-baseline gap-3">
      <span className={`mt-1.5 size-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-[10px] tracking-[0.18em] uppercase text-ink-dim w-20 shrink-0">
        {label}
      </span>
      <span className="flex-1">{value}</span>
    </li>
  );
}

function ReviewCta({ hasData }: { hasData: boolean }) {
  const prompt = "基于我的交易画像，帮我复盘最近 5 笔交易：胜的共性 / 败的共性 / 下一步可改进的 3 点";
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/?prompt=${encodeURIComponent(prompt)}`}
        className={hasData ? "btn-primary text-xs" : "btn-ghost text-xs opacity-60"}
        aria-disabled={!hasData}
        onClick={(e) => {
          if (!hasData) e.preventDefault();
        }}
      >
        🔍 让 AI 复盘最近 5 笔交易 →
      </Link>
      {!hasData && (
        <span className="text-[11px] text-ink-dim">
          需要至少 3 笔已平仓
        </span>
      )}
    </div>
  );
}

function StatsPanel({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="terminal-card p-5 text-xs text-ink-dim">加载统计...</div>
    );
  }
  if (stats.totalClosed === 0 && stats.totalOpen === 0) {
    return (
      <div className="terminal-card p-5 text-xs text-ink-muted leading-relaxed">
        还没有交易记录。每记一笔，TradePilot 就更懂你的胜率分布、优势 setup、常踩的坑。
      </div>
    );
  }

  return (
    <div className="terminal-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-ink-dim">
          数据指标
        </span>
        <span className="text-[10px] text-ink-dim">
          已平仓 {stats.totalClosed} · 持仓中 {stats.totalOpen}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="胜率" value={`${stats.winRate.toFixed(0)}%`} tone={stats.winRate >= 50 ? "razer" : "danger"} />
        <Stat
          label="平均收益"
          value={`${stats.avgPnlPct >= 0 ? "+" : ""}${stats.avgPnlPct.toFixed(2)}%`}
          tone={stats.avgPnlPct >= 0 ? "razer" : "danger"}
        />
        <Stat
          label="最大单笔"
          value={stats.bestPct != null ? `+${stats.bestPct.toFixed(1)}%` : "—"}
          tone="razer"
        />
        <Stat
          label="最大回撤"
          value={stats.worstPct != null ? `${stats.worstPct.toFixed(1)}%` : "—"}
          tone="danger"
        />
      </div>

      {stats.bySetup.length > 0 && (
        <div>
          <div className="text-[10px] tracking-widest uppercase text-ink-dim mb-2">
            按策略类型 SETUP
          </div>
          <div className="space-y-1.5">
            {stats.bySetup.slice(0, 5).map((s) => (
              <div
                key={s.setup}
                className="flex items-center text-xs gap-3"
              >
                <span className="w-24 text-ink-base shrink-0">{s.setup}</span>
                <span className="text-ink-dim">×{s.count}</span>
                <span
                  className={
                    s.winRate >= 60
                      ? "text-accent-razer"
                      : s.winRate >= 40
                        ? "text-ink-base"
                        : "text-accent-danger"
                  }
                >
                  胜率 {s.winRate.toFixed(0)}%
                </span>
                <span className={s.avgPnlPct >= 0 ? "text-accent-razer/80" : "text-accent-danger/80"}>
                  均 {s.avgPnlPct >= 0 ? "+" : ""}
                  {s.avgPnlPct.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "razer" | "danger" | "muted" }) {
  const toneClass =
    tone === "razer"
      ? "text-accent-razer"
      : tone === "danger"
        ? "text-accent-danger"
        : "text-ink-muted";
  return (
    <div className="terminal-card p-3 bg-bg-card/40">
      <div className="text-[10px] tracking-widest uppercase text-ink-dim">{label}</div>
      <div className={`mt-1 text-2xl font-light ${toneClass}`}>{value}</div>
    </div>
  );
}

function NewTradeForm({ onSaved }: { onSaved: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [direction, setDirection] = useState<Direction>("LONG");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [setup, setSetup] = useState(SETUP_OPTIONS[0]);
  const [timeframe, setTimeframe] = useState("4h");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: symbol.trim(),
          direction,
          entryPrice: Number(entry),
          stopPrice: stop ? Number(stop) : null,
          targetPrice: target ? Number(target) : null,
          setup,
          timeframe,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "保存失败");
      } else {
        onSaved();
      }
    } catch {
      setErr("网络异常");
    } finally {
      setBusy(false);
    }
  }

  // RR 实时计算
  const e = Number(entry);
  const s = Number(stop);
  const t = Number(target);
  const showRR = e > 0 && s > 0 && t > 0;
  const risk = showRR ? Math.abs(e - s) : 0;
  const reward = showRR ? Math.abs(t - e) : 0;
  const rr = showRR && risk > 0 ? reward / risk : 0;

  return (
    <form onSubmit={submit} className="terminal-card p-5 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Input label="标的" value={symbol} onChange={setSymbol} placeholder="BTCUSDT / EURUSD" required />
        <SelectField
          label="方向"
          value={direction}
          options={[
            { v: "LONG", l: "做多 LONG" },
            { v: "SHORT", l: "做空 SHORT" },
          ]}
          onChange={(v) => setDirection(v as Direction)}
        />
        <SelectField
          label="周期"
          value={timeframe}
          options={TIMEFRAMES.map((t) => ({ v: t, l: t }))}
          onChange={setTimeframe}
        />
        <SelectField
          label="策略类型"
          value={setup}
          options={SETUP_OPTIONS.map((s) => ({ v: s, l: s }))}
          onChange={setSetup}
        />
        <Input label="入场价" value={entry} onChange={setEntry} type="number" required />
        <Input label="止损价" value={stop} onChange={setStop} type="number" />
        <Input label="止盈价" value={target} onChange={setTarget} type="number" />
        <div>
          <span className="text-[10px] tracking-widest uppercase text-ink-dim block mb-1">
            RR 风险回报
          </span>
          <div className={`mt-2 text-sm ${rr >= 2 ? "text-accent-razer" : rr > 0 ? "text-accent-danger" : "text-ink-dim"}`}>
            {rr > 0 ? `1:${rr.toFixed(2)}` : "—"}
            {rr > 0 && rr < 2 && <span className="text-[10px] ml-1">(低于 2:1 不建议)</span>}
          </div>
        </div>
      </div>

      <div>
        <span className="text-[10px] tracking-widest uppercase text-ink-dim block mb-1">
          开仓理由 / 备注
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-bg-card border border-bg-edge rounded-md px-3 py-2 text-xs text-ink-bright outline-none focus:border-accent-razer/60"
          placeholder="例如：4H FVG 回踩 + 1H MSB 多头确认"
        />
      </div>

      {err && (
        <div className="text-xs text-accent-danger border border-accent-danger/40 bg-accent-danger/10 rounded-md px-3 py-2">
          {err}
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={busy || !symbol || !entry} className="btn-primary text-xs disabled:opacity-50">
          {busy ? "保存中..." : "记录开仓"}
        </button>
      </div>
    </form>
  );
}

function TradeTable({ trades, onChanged }: { trades: Trade[]; onChanged: () => void }) {
  if (trades.length === 0) {
    return (
      <div className="terminal-card p-5 text-xs text-ink-muted text-center">
        还没有交易，点上面的「+ 新增交易」开始记录第一笔
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {trades.map((t) => <TradeRow key={t.id} trade={t} onChanged={onChanged} />)}
    </div>
  );
}

function TradeRow({ trade, onChanged }: { trade: Trade; onChanged: () => void }) {
  const [closing, setClosing] = useState(false);
  const [exitPrice, setExitPrice] = useState("");
  const [busy, setBusy] = useState(false);

  async function close() {
    setBusy(true);
    try {
      const res = await fetch(`/api/trades/${trade.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitPrice: Number(exitPrice), close: true }),
      });
      if (res.ok) {
        setClosing(false);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("确认删除这笔交易记录？")) return;
    const res = await fetch(`/api/trades/${trade.id}`, { method: "DELETE" });
    if (res.ok) onChanged();
  }

  const pnl = trade.pnlPct;
  const pnlTone = pnl == null ? "" : pnl >= 0 ? "text-accent-razer" : "text-accent-danger";

  return (
    <div className="terminal-card p-3 text-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
          trade.direction === "LONG" ? "bg-accent-razer/15 text-accent-razer" : "bg-accent-danger/15 text-accent-danger"
        }`}>
          {trade.direction}
        </span>
        <span className="font-bold text-ink-bright">{trade.symbol}</span>
        {trade.timeframe && <span className="text-ink-dim">{trade.timeframe}</span>}
        {trade.setup && <span className="text-accent-razer/80 text-[10px]">{trade.setup}</span>}
        <span className="text-ink-base">入 {trade.entryPrice}</span>
        {trade.stopPrice != null && <span className="text-ink-muted">止损 {trade.stopPrice}</span>}
        {trade.targetPrice != null && <span className="text-ink-muted">目标 {trade.targetPrice}</span>}
        {trade.exitPrice != null && <span className="text-ink-bright">出 {trade.exitPrice}</span>}
        {pnl != null && (
          <span className={`font-bold ${pnlTone}`}>
            {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
          </span>
        )}
        <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] ${
          trade.status === "OPEN" ? "bg-accent-info/15 text-accent-info" : "bg-bg-edge text-ink-muted"
        }`}>
          {trade.status === "OPEN" ? "持仓中" : "已平仓"}
        </span>
      </div>
      {trade.notes && (
        <div className="text-ink-muted text-[11px] mt-1.5 leading-relaxed">{trade.notes}</div>
      )}
      <div className="flex gap-2 mt-2">
        {trade.status === "OPEN" && !closing && (
          <button onClick={() => setClosing(true)} className="text-[11px] text-accent-info hover:underline">
            平仓
          </button>
        )}
        {trade.status === "OPEN" && closing && (
          <div className="flex gap-2 items-center w-full">
            <input
              type="number"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value)}
              placeholder="平仓价"
              className="flex-1 bg-bg-card border border-bg-edge rounded px-2 py-1 text-xs text-ink-bright outline-none focus:border-accent-razer/60"
            />
            <button
              onClick={close}
              disabled={!exitPrice || busy}
              className="btn-primary text-[11px] disabled:opacity-50"
            >
              {busy ? "保存..." : "确认平仓"}
            </button>
            <button onClick={() => setClosing(false)} className="text-[11px] text-ink-dim">取消</button>
          </div>
        )}
        <button onClick={remove} className="ml-auto text-[11px] text-ink-dim hover:text-accent-danger">
          删除
        </button>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-widest uppercase text-ink-dim block mb-1">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        step="any"
        className="w-full bg-bg-card border border-bg-edge rounded-md px-3 py-2 text-sm text-ink-bright outline-none focus:border-accent-razer/60"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] tracking-widest uppercase text-ink-dim block mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bg-card border border-bg-edge rounded-md px-3 py-2 text-sm text-ink-bright outline-none focus:border-accent-razer/60"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 新增：画像完成度进度条
// ─────────────────────────────────────────────────────────────────────────────
function ProfileCompletionBar({
  stats,
  loading,
}: {
  stats: Stats | null;
  loading: boolean;
}) {
  if (loading || !stats) return null;
  const pct = stats.profileCompletion ?? 0;
  const label = stats.profileCompletionLabel ?? "AI 刚认识你，继续记录吧";

  return (
    <div className="rounded-xl border border-white/[0.04] bg-bg-panel/30 px-5 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-ink-dim">
          AI 画像完成度
        </span>
        <span className="text-[11px] text-accent-razer font-bold">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-bg-edge overflow-hidden">
        <div
          className="h-full bg-accent-razer transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-ink-muted">{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 新增：AI 观察卡
// ─────────────────────────────────────────────────────────────────────────────
function AIObservationCard({
  stats,
  loading,
  isPaid,
}: {
  stats: Stats | null;
  loading: boolean;
  isPaid: boolean;
}) {
  if (loading) return null;

  // 数据不足时显示引导
  if (!stats || stats.totalClosed < 3) {
    return (
      <div className="rounded-xl border border-accent-razer/20 bg-bg-panel/40 px-5 py-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-accent-razer animate-pulseLine" />
          <span className="text-[10px] tracking-[0.18em] uppercase text-accent-razer">
            AI 理解中心
          </span>
        </div>
        <p className="text-sm text-ink-base leading-relaxed">
          📊 AI 还在认识你
        </p>
        <p className="text-[12px] text-ink-muted leading-relaxed">
          你目前有 <span className="text-ink-bright font-bold">{stats?.totalClosed ?? 0}</span> 笔已平仓交易。
          再记录 <span className="text-accent-razer font-bold">{Math.max(0, 3 - (stats?.totalClosed ?? 0))}</span> 笔，
          AI 就能开始观察你的交易习惯了。
        </p>
        <p className="text-[11px] text-ink-dim">每记一笔，AI 就多了解你一点。</p>
      </div>
    );
  }

  const topSymbol = stats.bySymbol[0] ?? null;
  const ranked = stats.bySetup.filter((s) => s.count >= 2);
  const bestSetup = ranked.length > 0
    ? ranked.reduce((a, b) => (a.winRate > b.winRate ? a : b))
    : null;
  const weakSetup = ranked.length > 1
    ? ranked.reduce((a, b) => (a.avgPnlPct < b.avgPnlPct ? a : b))
    : null;

  // 持仓时长文字
  function holdLabel(h: number | null): string {
    if (h == null) return "—";
    if (h < 1) return "不到 1 小时（超短线）";
    if (h < 8) return `约 ${h.toFixed(0)} 小时（日内）`;
    if (h < 48) return `约 ${h.toFixed(0)} 小时（短线）`;
    return `约 ${(h / 24).toFixed(0)} 天（波段）`;
  }

  // 最近状态文字
  function moodLabel(pct: number | null): string {
    if (pct == null) return "—";
    if (pct > 1) return `最近 3 笔平均盈利 +${pct.toFixed(2)}%，状态不错`;
    if (pct < -1) return `最近 3 笔平均亏损 ${pct.toFixed(2)}%，注意控制节奏`;
    return `最近 3 笔基本持平（${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%）`;
  }

  // 胜率趋势文字
  function trendLabel(recent: number | null, overall: number): string {
    if (recent == null) return "—";
    const diff = recent - overall;
    if (diff > 5) return `最近 5 笔胜率 ${recent.toFixed(0)}%，比整体高 ${diff.toFixed(0)}%，状态上升`;
    if (diff < -5) return `最近 5 笔胜率 ${recent.toFixed(0)}%，比整体低 ${Math.abs(diff).toFixed(0)}%，注意调整`;
    return `最近 5 笔胜率 ${recent.toFixed(0)}%，与整体持平`;
  }

  // 止损习惯文字
  function stopLabel(rate: number | null): string {
    if (rate == null) return "—";
    if (rate >= 80) return `${rate.toFixed(0)}% 的交易设置了止损，习惯很好`;
    if (rate >= 50) return `${rate.toFixed(0)}% 的交易设置了止损，还可以更严格`;
    return `只有 ${rate.toFixed(0)}% 的交易设置了止损，建议每笔都填`;
  }

  // 做多/做空偏好
  function longShortLabel(ratio: number | null): string {
    if (ratio == null) return "—";
    if (ratio >= 70) return `偏多头（${ratio.toFixed(0)}% 做多）`;
    if (ratio <= 30) return `偏空头（${(100 - ratio).toFixed(0)}% 做空）`;
    return `多空均衡（做多 ${ratio.toFixed(0)}%）`;
  }

  // FREE 用户只显示前 3 项
  const allItems = [
    topSymbol && {
      icon: "🎯",
      label: "最常交易的品种",
      value: `${topSymbol.symbol}（共 ${topSymbol.count} 笔，胜率 ${topSymbol.winRate.toFixed(0)}%）`,
    },
    stats.topTimeframe && {
      icon: "⏱",
      label: "最常用的时间周期",
      value: stats.topTimeframe,
    },
    {
      icon: "📈",
      label: "胜率趋势",
      value: trendLabel(stats.recentWinRate, stats.winRate),
    },
    {
      icon: "⏳",
      label: "平均持仓时长",
      value: holdLabel(stats.avgHoldHours),
    },
    {
      icon: "🛡",
      label: "止损习惯",
      value: stopLabel(stats.stopLossRatePct),
    },
    bestSetup && {
      icon: "⚡",
      label: "胜率最高的策略",
      value: `${bestSetup.setup}（${bestSetup.count} 笔，胜率 ${bestSetup.winRate.toFixed(0)}%）`,
    },
    weakSetup && weakSetup.setup !== bestSetup?.setup && {
      icon: "⚠️",
      label: "最容易亏损的策略",
      value: `${weakSetup.setup}（${weakSetup.count} 笔，均 ${weakSetup.avgPnlPct.toFixed(2)}%）`,
    },
    {
      icon: "🔄",
      label: "做多/做空偏好",
      value: longShortLabel(stats.longRatioPct),
    },
    {
      icon: "💡",
      label: "最近状态",
      value: moodLabel(stats.recentMoodPct),
    },
  ].filter(Boolean) as { icon: string; label: string; value: string }[];

  const visibleItems = isPaid ? allItems : allItems.slice(0, 3);
  const lockedCount = allItems.length - visibleItems.length;

  return (
    <div className="rounded-xl border border-accent-razer/20 bg-bg-panel/40 px-5 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-accent-razer animate-pulseLine shadow-[0_0_8px_rgba(68,214,44,0.6)]" />
        <span className="text-[10px] tracking-[0.18em] uppercase text-accent-razer">
          AI 理解中心
        </span>
        <span className="ml-auto text-[10px] text-ink-dim">
          基于 {stats.totalClosed} 笔已平仓数据
        </span>
      </div>

      <ul className="space-y-3">
        {visibleItems.map((item) => (
          <li key={item.label} className="flex items-start gap-3 text-sm">
            <span className="text-base shrink-0 mt-0.5">{item.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] tracking-widest uppercase text-ink-dim mb-0.5">
                {item.label}
              </div>
              <div className="text-ink-base text-[13px] leading-snug">{item.value}</div>
            </div>
          </li>
        ))}
      </ul>

      {!isPaid && lockedCount > 0 && (
        <div className="rounded-lg border border-white/[0.06] bg-bg-edge/40 px-4 py-3 space-y-2">
          <p className="text-[12px] text-ink-muted">
            🔒 还有 <span className="text-ink-bright font-bold">{lockedCount}</span> 项观察被锁定
          </p>
          <p className="text-[11px] text-ink-dim">
            升级到 TP-MAX，AI 在每次对话中自动记住你的交易习惯。
          </p>
          <Link href="/pricing" className="inline-block text-[11px] text-accent-razer hover:underline">
            查看升级方案 →
          </Link>
        </div>
      )}

      <p className="text-[10px] text-ink-dim border-t border-white/[0.04] pt-3">
        以上为历史数据观察，不构成交易建议。
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 新增：最近 5 笔复盘入口
// ─────────────────────────────────────────────────────────────────────────────
function RecentTradesReview({
  trades,
  isPaid,
}: {
  trades: Trade[];
  isPaid: boolean;
}) {
  const [showUpgradeHint, setShowUpgradeHint] = useState(false);

  const recent = trades
    .filter((t) => t.status === "CLOSED" && t.pnlPct != null)
    .slice(0, 5);

  if (recent.length === 0) return null;

  function buildPrefill(t: Trade): string {
    const dir = t.direction === "LONG" ? "做多" : "做空";
    const pnl = t.pnlPct != null
      ? `${t.pnlPct >= 0 ? "+" : ""}${t.pnlPct.toFixed(2)}%`
      : "未知";
    const parts = [
      `帮我复盘一下这笔交易：`,
      `品种：${t.symbol}，方向：${dir}，`,
      `入场：${t.entryPrice}，出场：${t.exitPrice ?? "未知"}，盈亏：${pnl}`,
      t.setup ? `，策略：${t.setup}` : "",
      t.timeframe ? `，时间周期：${t.timeframe}` : "",
    ];
    return parts.join("");
  }

  // 所有复盘跳转到首页，首页通过 ?prompt= 预填并自动识别市场
  function reviewHref(t: Trade): string {
    return `/?prompt=${encodeURIComponent(buildPrefill(t))}`;
  }

  return (
    <div className="rounded-xl border border-white/[0.04] bg-bg-panel/30 px-5 py-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-[0.18em] uppercase text-ink-dim">
          最近 5 笔复盘
        </span>
        <Link href="/journal" className="text-[11px] text-ink-dim hover:text-ink-base">
          查看全部 →
        </Link>
      </div>

      <ul className="space-y-2">
        {recent.map((t) => {
          const pnl = t.pnlPct as number;
          const pnlTone = pnl >= 0 ? "text-accent-razer" : "text-accent-danger";
          const dir = t.direction === "LONG" ? "做多" : "做空";
          const dateStr = new Date(t.closedAt ?? t.openedAt).toLocaleDateString("zh-CN", {
            month: "numeric",
            day: "numeric",
          });

          return (
            <li
              key={t.id}
              className="flex items-center gap-2 text-xs py-1.5 border-b border-white/[0.03] last:border-0"
            >
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                t.direction === "LONG"
                  ? "bg-accent-razer/15 text-accent-razer"
                  : "bg-accent-danger/15 text-accent-danger"
              }`}>
                {dir}
              </span>
              <span className="font-bold text-ink-bright shrink-0">{t.symbol}</span>
              <span className={`font-bold ${pnlTone} shrink-0`}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}%
              </span>
              <span className="text-ink-dim shrink-0">{dateStr}</span>
              <div className="ml-auto shrink-0">
                {isPaid ? (
                  <Link
                    href={reviewHref(t)}
                    className="text-[11px] text-accent-razer hover:underline"
                    onClick={() => {/* prefill via URL param, handled by HomeClient */}}
                  >
                    AI 复盘 →
                  </Link>
                ) : (
                  <button
                    onClick={() => setShowUpgradeHint(true)}
                    className="text-[11px] text-ink-dim hover:text-accent-razer"
                  >
                    🔒 AI 复盘
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {showUpgradeHint && (
        <div className="rounded-lg border border-accent-razer/20 bg-bg-edge/40 px-4 py-3 space-y-2">
          <p className="text-[12px] text-ink-base">
            🔒 AI 复盘需要 TP-MAX 或以上
          </p>
          <p className="text-[11px] text-ink-muted">
            升级后，AI 会结合你的交易记录，帮你分析这笔交易的得失。
          </p>
          <div className="flex gap-3">
            <Link href="/pricing" className="text-[11px] text-accent-razer hover:underline">
              升级 TP-MAX →
            </Link>
            <button
              onClick={() => setShowUpgradeHint(false)}
              className="text-[11px] text-ink-dim hover:text-ink-base"
            >
              暂不升级
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
