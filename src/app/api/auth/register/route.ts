import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { INVITER_BONUS_PTS } from "@/lib/pricing";

export const runtime = "nodejs";

const TRADING_STYLES = ["INTRADAY", "SWING", "POSITION", "LEARNING"] as const;

const schema = z.object({
  nickname: z
    .string()
    .min(2, "昵称至少 2 位")
    .max(24, "昵称不超过 24 位")
    .regex(/^[\w一-龥][\w一-龥\-\.]*$/, "昵称仅支持中英数字与 _ - ."),
  password: z.string().min(6, "密码至少 6 位").max(64),
  inviteCode: z.string().max(64).optional().nullable(),
  tradingStyle: z.enum(TRADING_STYLES).optional(),
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
  const trimmedCode = parsed.data.inviteCode?.trim() ?? "";
  const tradingStyle = parsed.data.tradingStyle ?? "LEARNING";
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

  // 注册策略（2026-05-07 改）：邀请码可选。
  //   - 留空 → 顶级孤儿节点 (parentAgentId = null), 无邀请奖励
  //   - 填 SEED 码 → 顶级管理员节点 (parentAgentId = null), 无邀请奖励
  //   - 填真实邀请人 → 绑父级 + 邀请人 +200pt
  //   - 填了但无效 → 拒绝（不静默忽略，避免用户以为绑了实际没绑）
  let parentAgentId: string | null = null;

  if (trimmedCode) {
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
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // 用户创建 + 邀请人奖励原子化：任一失败回滚
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        nickname,
        passwordHash,
        parentAgentId,
        tradingStyle,
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
