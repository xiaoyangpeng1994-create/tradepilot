import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregateStats, type TradeStatus } from "@/lib/journal";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id },
    select: { status: true, pnlPct: true, setup: true, symbol: true },
  });

  const stats = aggregateStats(
    trades.map((t) => ({
      status: t.status as TradeStatus,
      pnlPct: t.pnlPct,
      setup: t.setup,
      symbol: t.symbol,
    })),
  );

  return NextResponse.json(stats);
}
