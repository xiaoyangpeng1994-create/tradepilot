import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProModel, mockReply } from "@/lib/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COST_TEXT = 1;
const COST_WITH_IMAGE = 5;

export async function POST(req: NextRequest) {
  const { channel, message, image } = (await req.json()) as {
    channel: string;
    message: string;
    image?: string | null;
  };

  if (!channel || typeof message !== "string") {
    return new Response("bad request", { status: 400 });
  }

  const session = await auth();
  const userId = session?.user?.id;
  const cost = image ? COST_WITH_IMAGE : COST_TEXT;

  let chatSessionId: string | null = null;

  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { computePts: true, vipLevel: true, vipExpiresAt: true },
    });
    if (!user) return new Response("user not found", { status: 404 });

    const isVipActive =
      user.vipLevel !== "FREE" &&
      (!user.vipExpiresAt || user.vipExpiresAt.getTime() > Date.now());

    if (!isVipActive && user.computePts < cost) {
      return new Response(
        JSON.stringify({ error: "INSUFFICIENT_PTS", needed: cost, have: user.computePts }),
        { status: 402, headers: { "Content-Type": "application/json" } },
      );
    }

    const existing = await prisma.chatSession.findFirst({
      where: { userId, channel },
      orderBy: { updatedAt: "desc" },
    });
    const cs =
      existing ??
      (await prisma.chatSession.create({ data: { userId, channel } }));
    chatSessionId = cs.id;

    await prisma.chatMessage.create({
      data: {
        sessionId: cs.id,
        role: "user",
        content: message,
        imageData: image || null,
      },
    });

    if (!isVipActive) {
      await prisma.user.update({
        where: { id: userId },
        data: { computePts: { decrement: cost } },
      });
    }

    await prisma.chatSession.update({
      where: { id: cs.id },
      data: { updatedAt: new Date() },
    });
  }

  const model = getProModel();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let acc = "";
      try {
        if (!model) {
          const text = mockReply(message);
          for (const ch of text) {
            controller.enqueue(encoder.encode(ch));
            acc += ch;
            await new Promise((r) => setTimeout(r, 6));
          }
        } else {
          const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
            { text: message },
          ];
          if (image) {
            const m = image.match(/^data:(image\/[^;]+);base64,(.+)$/);
            if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } });
          }
          const result = await model.generateContentStream({
            contents: [{ role: "user", parts }],
          });
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
              acc += text;
            }
          }
        }
      } catch (e) {
        const err = "\n\n[模型推理异常，请稍后重试]";
        controller.enqueue(encoder.encode(err));
        acc += err;
      } finally {
        if (chatSessionId) {
          try {
            await prisma.chatMessage.create({
              data: { sessionId: chatSessionId, role: "assistant", content: acc },
            });
          } catch {}
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
