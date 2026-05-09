import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "自选关注 · Coming Soon",
};

export default function WatchlistPage() {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-12">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <div className="text-6xl">⭐</div>
        <h1 className="text-2xl font-bold text-ink-bright tracking-wide">
          自选关注
        </h1>
        <div className="text-[10px] tracking-widest uppercase text-accent-razer">
          Coming Soon
        </div>
        <p className="text-sm text-ink-muted leading-relaxed">
          关注你常看的资产，AI 自动每日 brief。
          <br />
          收到价格异动、关键结构变化、宏观事件冲击时第一时间通知你。
        </p>
        <div className="pt-4">
          <button
            disabled
            className="btn-ghost opacity-60 cursor-not-allowed"
          >
            通知我上线
          </button>
        </div>
      </div>
    </div>
  );
}
