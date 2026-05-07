import { Sidebar } from "@/components/layout/Sidebar";
import { TopTicker } from "@/components/layout/TopTicker";
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
        <Sidebar pts={pts} isVipActive={isVipActive} />
        <main className="flex-1 min-w-0 grid-bg overflow-hidden flex flex-col">
          {children}
        </main>
      </div>
      <footer className="border-t border-bg-edge bg-bg-panel/60 px-3 sm:px-6 py-1.5 flex items-center justify-between gap-3 text-[10px] text-ink-dim tracking-wide">
        <span className="line-clamp-2 sm:line-clamp-1">
          ⚠ 行情滚动条等均为<span className="text-accent-gold">演示数据</span>，不构成投资建议；交易有风险，决策请独立判断。
        </span>
        <span className="shrink-0 text-ink-dim/70 hidden sm:inline">DEV_BUILD · v0.1</span>
      </footer>
    </div>
  );
}
