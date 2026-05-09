import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const createSchema = z.object({
  symbol: z.string().min(1).max(32),
  channel: z.string().max(32).optional().nullable(),
  direction: z.enum(["LONG", "SHORT"]),
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive().optional().nullable(),
  stopPrice: z.number().positive().optional().nullable(),
  targetPrice: z.number().positive().optional().nullable(),
  setup: z.string().max(32).optional().nullable(),
  timeframe: z.string().max(16).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status"); // OPEN | CLOSED | undefined
  const where: { userId: string; status?: string } = { userId: session.user.id };
  if (status === "OPEN" || status === "CLOSED") where.status = status;

  const trades = await prisma.trade.findMany({
    where,
    orderBy: { openedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({
    trades: trades.map((t) => ({
      id: t.id,
      symbol: t.symbol,
      channel: t.channel,
      direction: t.direction,
      entryPrice: t.entryPrice,
      stopPrice: t.stopPrice,
      targetPrice: t.targetPrice,
      exitPrice: t.exitPrice,
      pnlPct: t.pnlPct,
      status: t.status,
      setup: t.setup,
      timeframe: t.timeframe,
      notes: t.notes,
      openedAt: t.openedAt.toISOString(),
      closedAt: t.closedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数校验失败" }, { status: 400 });
  }

  // 当 exitPrice 同时提供时（聊天里识别到的 ROUND_TRIP），直接创建为 CLOSED
  const isRoundTrip = parsed.data.exitPrice != null;
  const pnlPct = isRoundTrip
    ? Number(
        (
          (parsed.data.direction === "LONG"
            ? ((parsed.data.exitPrice! - parsed.data.entryPrice) / parsed.data.entryPrice) * 100
            : ((parsed.data.entryPrice - parsed.data.exitPrice!) / parsed.data.entryPrice) * 100)
        ).toFixed(2),
      )
    : null;

  const created = await prisma.trade.create({
    data: {
      userId: session.user.id,
      symbol: parsed.data.symbol.trim(),
      channel: parsed.data.channel ?? null,
      direction: parsed.data.direction,
      entryPrice: parsed.data.entryPrice,
      exitPrice: parsed.data.exitPrice ?? null,
      pnlPct,
      stopPrice: parsed.data.stopPrice ?? null,
      targetPrice: parsed.data.targetPrice ?? null,
      setup: parsed.data.setup ?? null,
      timeframe: parsed.data.timeframe ?? null,
      notes: parsed.data.notes ?? null,
      status: isRoundTrip ? "CLOSED" : "OPEN",
      closedAt: isRoundTrip ? new Date() : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
