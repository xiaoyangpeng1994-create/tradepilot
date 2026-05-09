import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  aggregateStatsFull,
  computeProfileCompletion,
  profileCompletionLabel,
  type TradeStatus,
} from "@/lib/journal";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id },
    orderBy: { openedAt: "desc" },
    select: {
      status: true,
      pnlPct: true,
      setup: true,
      symbol: true,
      direction: true,
      stopPrice: true,
      timeframe: true,
      notes: true,
      openedAt: true,
      closedAt: true,
    },
  });

  const stats = aggregateStatsFull(
    trades.map((t) => ({
      status: t.status as TradeStatus,
      pnlPct: t.pnlPct,
      setup: t.setup,
      symbol: t.symbol,
      direction: t.direction,
      stopPrice: t.stopPrice,
      timeframe: t.timeframe,
      openedAt: t.openedAt,
      closedAt: t.closedAt,
    })),
  );

  // 画像完成度
  const uniqueSetups = new Set(trades.map((t) => t.setup).filter(Boolean));
  const completion = computeProfileCompletion({
    totalTrades: trades.length,
    totalClosed: stats.totalClosed,
    setupFilledCount: trades.filter((t) => t.setup).length,
    stopFilledCount: trades.filter((t) => t.stopPrice != null).length,
    timeframeFilledCount: trades.filter((t) => t.timeframe).length,
    notesFilledCount: trades.filter((t) => t.notes).length,
    uniqueSetupCount: uniqueSetups.size,
  });

  return NextResponse.json({
    ...stats,
    profileCompletion: completion,
    profileCompletionLabel: profileCompletionLabel(completion),
  });
}
