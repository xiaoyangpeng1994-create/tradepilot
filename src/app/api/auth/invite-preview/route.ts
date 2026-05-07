import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) return NextResponse.json({ valid: false });

  const seed = process.env.SEED_INVITE_CODE?.trim();
  if (seed && code === seed) {
    return NextResponse.json({ valid: true, isSeed: true });
  }

  const inviter = await prisma.user.findFirst({
    where: { OR: [{ id: code }, { nickname: code }] },
    select: { nickname: true },
  });

  if (!inviter) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, inviterName: inviter.nickname });
}
