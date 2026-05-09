import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MESSAGES = 30;

export async function GET(req: NextRequest) {
  const sessionIdParam = req.nextUrl.searchParams.get("sessionId");
  const channel = req.nextUrl.searchParams.get("channel");

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ messages: [] });

  let cs: { id: string } | null = null;

  if (sessionIdParam) {
    // 按 sessionId 精确取 — 必须做 owner 校验，防越权
    const found = await prisma.chatSession.findUnique({
      where: { id: sessionIdParam },
      select: { id: true, userId: true },
    });
    if (!found || found.userId !== userId) {
      return Response.json({ messages: [] });
    }
    cs = { id: found.id };
  } else if (channel) {
    cs = await prisma.chatSession.findFirst({
      where: { userId, channel },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
  } else {
    return Response.json({ messages: [] });
  }

  if (!cs) return Response.json({ messages: [] });

  const rows = await prisma.chatMessage.findMany({
    where: { sessionId: cs.id, role: { in: ["user", "assistant"] } },
    orderBy: { createdAt: "desc" },
    take: MAX_MESSAGES,
    select: { id: true, role: true, content: true, imageData: true, createdAt: true },
  });

  return Response.json({
    messages: rows.reverse().map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant",
      content: m.content,
      imageData: m.imageData ?? undefined,
      ts: m.createdAt.toLocaleTimeString("zh-CN", { hour12: false }),
    })),
  });
}

// 清空当前用户在指定频道的会话历史。
// 删除该频道最新 ChatSession 下的所有 ChatMessage（保留 session 本体，下次发消息复用）。
export async function DELETE(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel");
  if (!channel) return Response.json({ error: "missing channel" }, { status: 400 });

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const cs = await prisma.chatSession.findFirst({
    where: { userId, channel },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!cs) return Response.json({ ok: true, deleted: 0 });

  const result = await prisma.chatMessage.deleteMany({ where: { sessionId: cs.id } });
  return Response.json({ ok: true, deleted: result.count });
}
