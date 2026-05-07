"use client";
import { useEffect, useState } from "react";

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <StatsPanel stats={stats} loading={loading} />

      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-ink-dim">
          TRADE_HISTORY · {trades.length} 条
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

function StatsPanel({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading || !stats) {
    return (
      <div className="terminal-card p-5 text-xs text-ink-dim">加载统计...</div>
    );
  }
  if (stats.totalClosed === 0 && stats.totalOpen === 0) {
    return (
      <div className="terminal-card p-5 text-xs text-ink-muted leading-relaxed">
        还没有交易记录。每记录一笔交易，AI 将更懂你——胜率、最强模式、最弱模式都会沉淀下来反向喂给 AI 做个性化建议。
      </div>
    );
  }

  return (
    <div className="terminal-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-ink-dim">
          PERFORMANCE_OVERVIEW
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
