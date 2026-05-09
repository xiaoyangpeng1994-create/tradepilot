import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDynamicSuggestions } from "@/lib/intel";
import { AIWelcomeCard } from "@/components/home/AIWelcomeCard";
import { MarketIntelPanel } from "@/components/home/MarketIntelPanel";
import { CollapsibleOnMobile } from "@/components/home/CollapsibleOnMobile";
import { MemberStatusCard } from "@/components/chat/ChatWindow";
import { HomeClient } from "./HomeClient";

export const metadata: Metadata = {
  title: "洞察AI · TradePilot",
  description:
    "AI 交易副驾驶 — 问任何市场、上传 K 线、分析持仓，让 AI 帮你理解市场。",
};

// 让首页每次访问都重新派生欢迎语 / 情报快照（数据有 60s 缓存兜底，不会真的每次重打 Binance）
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  // 决定动态 suggestions 是否需要"看看我的持仓"那条
  let hasOpenPosition = false;
  let vipLevel = "FREE";
  let vipExpiresAt: string | null = null;
  let computePts = 0;

  if (session?.user?.id) {
    const [openCount, user] = await Promise.all([
      prisma.trade.count({
        where: { userId: session.user.id, status: "OPEN" },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { vipLevel: true, vipExpiresAt: true, computePts: true },
      }),
    ]);
    hasOpenPosition = openCount > 0;
    if (user) {
      vipLevel = user.vipLevel;
      vipExpiresAt = user.vipExpiresAt ? user.vipExpiresAt.toISOString() : null;
      computePts = user.computePts;
    }
  }

  const suggestions = getDynamicSuggestions(new Date(), hasOpenPosition);

  return (
    <HomeClient
      welcomeSlot={<AIWelcomeCard />}
      intelSlot={
        <CollapsibleOnMobile label="今日市场情报">
          <MarketIntelPanel />
        </CollapsibleOnMobile>
      }
      memberStatusSlot={
        session?.user?.id ? (
          <MemberStatusCard
            vipLevel={vipLevel}
            vipExpiresAt={vipExpiresAt}
            computePts={computePts}
          />
        ) : null
      }
      suggestions={suggestions}
    />
  );
}
