import { Sidebar } from "@/components/layout/Sidebar";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProPlusLevel } from "@/lib/pricing";

export default async function TerminalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  let pts = 0;
  let isVipActive = false;
  let isVipPlusActive = false;
  let agentLevel = 0;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { computePts: true, vipLevel: true, vipExpiresAt: true, agentLevel: true },
    });
    if (user) {
      pts = user.computePts;
      agentLevel = user.agentLevel;
      isVipActive =
        user.vipLevel !== "FREE" &&
        (!user.vipExpiresAt || user.vipExpiresAt.getTime() > Date.now());
      isVipPlusActive = isVipActive && isProPlusLevel(user.vipLevel);
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#171717" }}>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar pts={pts} isVipActive={isVipActive} isVipPlusActive={isVipPlusActive} agentLevel={agentLevel} />
        <main className="flex-1 min-w-0 overflow-hidden flex flex-col" style={{ background: "#171717" }}>
          {children}
        </main>
      </div>
      <footer
        className="px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-[11px]"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          background: "#171717",
          color: "#737373",
        }}
      >
        <span className="line-clamp-1">
          AI 输出仅供参考，不构成投资建议；交易有风险，决策请独立判断。
        </span>
        <span className="shrink-0 hidden sm:inline" style={{ color: "#525252" }}>v0.1</span>
      </footer>
    </div>
  );
}
