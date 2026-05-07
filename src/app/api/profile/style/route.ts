import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const TRADING_STYLES = ["INTRADAY", "SWING", "POSITION", "LEARNING"] as const;

const schema = z.object({
  tradingStyle: z.enum(TRADING_STYLES),
});

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "tradingStyle 取值非法" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { tradingStyle: parsed.data.tradingStyle },
  });

  return NextResponse.json({ ok: true, tradingStyle: parsed.data.tradingStyle });
}
