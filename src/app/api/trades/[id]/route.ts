import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computePnlPct, type Direction } from "@/lib/journal";

export const runtime = "nodejs";

const patchSchema = z
  .object({
    exitPrice: z.number().positive().optional(),
    stopPrice: z.number().positive().optional().nullable(),
    targetPrice: z.number().positive().optional().nullable(),
    setup: z.string().max(32).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    close: z.boolean().optional(), // true = 标记为 CLOSED 并算 pnl
  })
  .refine(
    (v) =>
      Object.keys(v).length > 0 &&
      (!v.close || v.exitPrice != null), // close=true 必须给 exitPrice
    { message: "平仓必须提供 exitPrice" },
  );

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "参数校验失败" }, { status: 400 });
  }

  // 校验 trade 属于当前用户
  const existing = await prisma.trade.findFirst({
    where: { id: ctx.params.id, userId: session.user.id },
    select: { id: true, direction: true, entryPrice: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "未找到该交易记录" }, { status: 404 });

  const patch: {
    exitPrice?: number;
    stopPrice?: number | null;
    targetPrice?: number | null;
    setup?: string | null;
    notes?: string | null;
    status?: string;
    pnlPct?: number;
    closedAt?: Date;
  } = {};
  if (parsed.data.exitPrice != null) patch.exitPrice = parsed.data.exitPrice;
  if (parsed.data.stopPrice !== undefined) patch.stopPrice = parsed.data.stopPrice;
  if (parsed.data.targetPrice !== undefined) patch.targetPrice = parsed.data.targetPrice;
  if (parsed.data.setup !== undefined) patch.setup = parsed.data.setup;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  if (parsed.data.close && parsed.data.exitPrice != null) {
    patch.status = "CLOSED";
    patch.pnlPct = computePnlPct(
      existing.direction as Direction,
      existing.entryPrice,
      parsed.data.exitPrice,
    );
    patch.closedAt = new Date();
  }

  await prisma.trade.update({
    where: { id: ctx.params.id },
    data: patch,
  });

  return NextResponse.json({ ok: true, pnlPct: patch.pnlPct ?? null });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: { id: string } },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const existing = await prisma.trade.findFirst({
    where: { id: ctx.params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "未找到该交易记录" }, { status: 404 });

  await prisma.trade.delete({ where: { id: ctx.params.id } });
  return NextResponse.json({ ok: true });
}
