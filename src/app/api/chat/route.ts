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
  let ptsBalanceAfter: number | null = null;
  let isVip = false;

  if (userId) {
    // 校验 + 扣点 + 写 user 消息 三步原子化，任一失败回滚（不影响 streaming 阶段）
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { computePts: true, vipLevel: true, vipExpiresAt: true },
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        const isVipActive =
          user.vipLevel !== "FREE" &&
          (!user.vipExpiresAt || user.vipExpiresAt.getTime() > Date.now());

        if (!isVipActive && user.computePts < cost) {
          throw new Error(
            JSON.stringify({ code: "INSUFFICIENT_PTS", needed: cost, have: user.computePts }),
          );
        }

        const existing = await tx.chatSession.findFirst({
          where: { userId, channel },
          orderBy: { updatedAt: "desc" },
        });
        const cs =
          existing ??
          (await tx.chatSession.create({ data: { userId, channel } }));

        if (!isVipActive) {
          await tx.user.update({
            where: { id: userId },
            data: { computePts: { decrement: cost } },
          });
        }

        await tx.chatMessage.create({
          data: {
            sessionId: cs.id,
            role: "user",
            content: message,
            imageData: image || null,
          },
        });

        await tx.chatSession.update({
          where: { id: cs.id },
          data: { updatedAt: new Date() },
        });

        return {
          sessionId: cs.id,
          balanceAfter: isVipActive ? user.computePts : user.computePts - cost,
          isVipActive,
        };
      });
      chatSessionId = result.sessionId;
      ptsBalanceAfter = result.balanceAfter;
      isVip = result.isVipActive;
    } catch (e) {
      const msg = (e as Error).message;
      if (msg === "USER_NOT_FOUND") {
        return new Response("user not found", { status: 404 });
      }
      try {
        const parsed = JSON.parse(msg);
        if (parsed.code === "INSUFFICIENT_PTS") {
          return new Response(
            JSON.stringify({ error: "INSUFFICIENT_PTS", needed: parsed.needed, have: parsed.have }),
            { status: 402, headers: { "Content-Type": "application/json" } },
          );
        }
      } catch {}
      return new Response("transaction failed", { status: 500 });
    }
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
      "X-Pts-Cost": String(cost),
      ...(ptsBalanceAfter !== null ? { "X-Pts-Balance": String(ptsBalanceAfter) } : {}),
      "X-Pts-Vip": String(isVip),
    },
  });
}
