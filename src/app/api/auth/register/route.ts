import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const INVITER_BONUS_PTS = 200;

const schema = z.object({
  nickname: z
    .string()
    .min(2, "昵称至少 2 位")
    .max(24, "昵称不超过 24 位")
    .regex(/^[\w一-龥][\w一-龥\-\.]*$/, "昵称仅支持中英数字与 _ - ."),
  password: z.string().min(6, "密码至少 6 位").max(64),
  inviteCode: z.string().min(1, "邀请码必填").max(64),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的请求体" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数校验失败" },
      { status: 400 },
    );
  }

  const { password } = parsed.data;
  const nickname = parsed.data.nickname.trim().toLowerCase();
  const trimmedCode = parsed.data.inviteCode.trim();
  const seedCode = process.env.SEED_INVITE_CODE?.trim();

  if (seedCode && nickname === seedCode.toLowerCase()) {
    return NextResponse.json(
      { error: "该昵称已被系统保留，请更换" },
      { status: 400 },
    );
  }

  const nameTaken = await prisma.user.findUnique({ where: { nickname } });
  if (nameTaken) {
    return NextResponse.json({ error: "该昵称已被占用" }, { status: 409 });
  }

  let parentAgentId: string | null = null;

  if (seedCode && trimmedCode === seedCode) {
    parentAgentId = null;
  } else {
    const inviter = await prisma.user.findFirst({
      where: { OR: [{ id: trimmedCode }, { nickname: trimmedCode.toLowerCase() }] },
      select: { id: true },
    });
    if (!inviter) {
      return NextResponse.json({ error: "邀请码无效" }, { status: 400 });
    }
    parentAgentId = inviter.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // 用户创建 + 邀请人奖励原子化：任一失败回滚
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        nickname,
        passwordHash,
        parentAgentId,
      },
      select: { id: true, nickname: true },
    });
    if (parentAgentId) {
      await tx.user.update({
        where: { id: parentAgentId },
        data: { computePts: { increment: INVITER_BONUS_PTS } },
      });
    }
    return created;
  });

  return NextResponse.json({ ok: true, user });
}
