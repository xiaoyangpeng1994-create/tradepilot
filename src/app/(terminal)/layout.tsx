import { Sidebar } from "@/components/layout/Sidebar";
import { TopTicker } from "@/components/layout/TopTicker";
import { StatsPanel } from "@/components/layout/StatsPanel";
import { PulseHubPanel, AutoPushPanel } from "@/components/layout/PulseHubPanel";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TerminalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let pts = 2500;
  let isVipActive = false;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { computePts: true, vipLevel: true, vipExpiresAt: true },
    });
    if (user) {
      pts = user.computePts;
      isVipActive =
        user.vipLevel !== "FREE" &&
        (!user.vipExpiresAt || user.vipExpiresAt.getTime() > Date.now());
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <TopTicker />
      <div className="flex flex-1 min-h-0">
        <div className="flex flex-col">
          <Sidebar pts={pts} isVipActive={isVipActive} />
        </div>
        <main className="flex-1 grid-bg overflow-hidden flex flex-col">
          {children}
        </main>
        <aside className="hidden xl:flex w-[260px] shrink-0 border-l border-bg-edge bg-bg-panel/40 flex-col gap-4 p-4">
          <StatsPanel />
          <PulseHubPanel />
          <AutoPushPanel />
        </aside>
      </div>
      <footer className="border-t border-bg-edge bg-bg-panel/60 px-6 py-1.5 flex items-center justify-between text-[10px] text-ink-dim tracking-wide">
        <span>
          ⚠ 行情滚动条、机构脉冲、AI 预测胜率均为<span className="text-accent-gold">演示数据</span>，不构成任何投资建议。市场有风险，决策需独立判断。
        </span>
        <span className="text-ink-dim/70">DEV_BUILD · v0.1</span>
      </footer>
    </div>
  );
}
