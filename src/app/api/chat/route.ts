import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  chatStream,
  qianwenAvailable,
  mockReply,
  modelDisplayLabel,
  type ChatHistoryItem,
  type TradingStyle,
} from "@/lib/qianwen";
import { buildMarketContext } from "@/lib/market";
import { buildTraderProfile } from "@/lib/journal";
import { detectTradeMention } from "@/lib/trade-detection";
import { isProPlusLevel, COST_TEXT_PT, COST_IMAGE_PT } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COST_TEXT = COST_TEXT_PT;
const COST_WITH_IMAGE = COST_IMAGE_PT;
const ANON_LIMIT = 5;
const ANON_WINDOW_MS = 24 * 3600 * 1000;

function fingerprint(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  const ip = (fwd.split(",")[0] || req.headers.get("x-real-ip") || "0.0.0.0").trim();
  const ua = req.headers.get("user-agent") ?? "";
  return createHash("sha256").update(`${ip}|${ua}`).digest("hex");
}

// 已知的"我不支持图片"幻觉短语。命中即视为污染历史，过滤掉以避免模型自我强化。
const POISON_PATTERNS: RegExp[] = [
  /不(?:接受|处理|支持).{0,8}(?:图片|截图|K\s*线\s*图|图像)/,
  /无(?:法)?(?:图像|图片|截图)(?:识别|上传|解析|处理)/,
  /(?:没有|不具备).{0,10}(?:图像|图片).{0,10}(?:识别|处理|分析)能力/,
  /本服务无.{0,8}图(?:像|片)/,
  /系统架构.{0,20}不支持.{0,8}图/,
  /不能(?:接收|读取|分析).{0,8}(?:图片|截图|图像)/,
];

function filterPoisonedHistory(rawAsc: ChatHistoryItem[]): ChatHistoryItem[] {
  const out: ChatHistoryItem[] = [];
  for (const cur of rawAsc) {
    if (cur.role === "assistant" && POISON_PATTERNS.some((p) => p.test(cur.content))) {
      // 把上一条 user（如果存在）也丢掉，避免悬空 user
      if (out.length > 0 && out[out.length - 1].role === "user") {
        out.pop();
      }
      continue;
    }
    out.push(cur);
  }
  return out;
}

/**
 * 匿名用户配额：以 IP+UA 哈希为主键，24h 滚动窗口最多 5 次。
 * 命中上限返回 { exceeded: true, count }，否则原子 +1 返回 { exceeded: false, count }。
 */
async function checkAnonQuota(
  fp: string,
): Promise<{ exceeded: boolean; count: number; resetAt: Date }> {
  const now = new Date();
  const existing = await prisma.anonQuota.findUnique({ where: { fingerprint: fp } });

  if (!existing || existing.resetAt < now) {
    // 首次访问，或 24h 窗口已过期 → 重置
    const resetAt = new Date(now.getTime() + ANON_WINDOW_MS);
    const row = await prisma.anonQuota.upsert({
      where: { fingerprint: fp },
      create: { fingerprint: fp, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return { exceeded: false, count: row.count, resetAt: row.resetAt };
  }

  if (existing.count >= ANON_LIMIT) {
    return { exceeded: true, count: existing.count, resetAt: existing.resetAt };
  }

  const updated = await prisma.anonQuota.update({
    where: { fingerprint: fp },
    data: { count: { increment: 1 } },
  });
  return { exceeded: false, count: updated.count, resetAt: updated.resetAt };
}

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
  let isVipPlus = false;
  let history: ChatHistoryItem[] = [];
  let tradingStyle: TradingStyle = "SWING";

  // 匿名访客闸门（IP+UA 滚动窗口）
  if (!userId) {
    const fp = fingerprint(req);
    const quota = await checkAnonQuota(fp);
    if (quota.exceeded) {
      return new Response(
        JSON.stringify({
          error: "ANON_LIMIT_EXCEEDED",
          limit: ANON_LIMIT,
          resetAt: quota.resetAt.toISOString(),
        }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  if (userId) {
    // 校验 + 扣点 + 写 user 消息 三步原子化，任一失败回滚（不影响 streaming 阶段）
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { computePts: true, vipLevel: true, vipExpiresAt: true, tradingStyle: true },
        });
        if (!user) throw new Error("USER_NOT_FOUND");

        const isVipActive =
          user.vipLevel !== "FREE" &&
          (!user.vipExpiresAt || user.vipExpiresAt.getTime() > Date.now());
        const isVipPlusActive = isVipActive && isProPlusLevel(user.vipLevel);

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

        // 取最近 10 条历史（在写入新 user 消息之前），按时间正序返回
        const recent = await tx.chatMessage.findMany({
          where: { sessionId: cs.id, role: { in: ["user", "assistant"] } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { role: true, content: true },
        });
        const rawAsc = recent.reverse() as ChatHistoryItem[];
        // 过滤掉历史里"我不支持图片"等幻觉短语的 assistant 回复（防止模型自我强化）；
        // 同时把对应的上一条 user 消息也丢掉，避免悬空 user 让模型困惑。
        const historyAsc = filterPoisonedHistory(rawAsc);

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
          isVipPlusActive,
          history: historyAsc,
          tradingStyle: user.tradingStyle as TradingStyle,
        };
      });
      chatSessionId = result.sessionId;
      ptsBalanceAfter = result.balanceAfter;
      isVip = result.isVipActive;
      isVipPlus = result.isVipPlusActive;
      history = result.history;
      tradingStyle = result.tradingStyle ?? "SWING";
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
      } catch {
        // 不是结构化 INSUFFICIENT_PTS 异常，落到下面通用 500
      }
      console.error("[/api/chat] transaction failed", { userId, channel, err: e });
      return new Response("transaction failed", { status: 500 });
    }
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let acc = "";
      try {
        if (!qianwenAvailable) {
          const text = mockReply(message);
          for (const ch of text) {
            controller.enqueue(encoder.encode(ch));
            acc += ch;
            await new Promise((r) => setTimeout(r, 6));
          }
        } else {
          const marketCtx = await buildMarketContext(channel, message, tradingStyle);
          // 登录用户拼上交易档案——让 AI 知道用户的胜率/优势模式/当前持仓
          const traderProfile = userId ? await buildTraderProfile(userId) : "";
          const fullCtx = traderProfile
            ? `${marketCtx}\n\n${traderProfile}`
            : marketCtx;
          for await (const delta of chatStream(message, {
            image,
            history,
            extraSystem: fullCtx,
            tier: isVipPlus ? "vip_plus" : isVip ? "vip" : "free",
            style: tradingStyle,
          })) {
            controller.enqueue(encoder.encode(delta));
            acc += delta;
          }
        }
      } catch (e) {
        console.error("[/api/chat] stream error", { userId, channel, hasImage: !!image, err: e });
        const err = "\n\n[模型推理异常，请稍后重试]";
        controller.enqueue(encoder.encode(err));
        acc += err;
      } finally {
        if (chatSessionId) {
          try {
            await prisma.chatMessage.create({
              data: { sessionId: chatSessionId, role: "assistant", content: acc },
            });
          } catch (e) {
            console.error("[/api/chat] persist assistant message failed", { sessionId: chatSessionId, err: e });
          }
        }
        controller.close();
      }
    },
  });

  const tradeHintHeaders = userId
    ? await buildTradeHintHeaders(userId, message)
    : {};

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-Pts-Cost": String(cost),
      ...(ptsBalanceAfter !== null ? { "X-Pts-Balance": String(ptsBalanceAfter) } : {}),
      "X-Pts-Vip": String(isVip),
      "X-Model-Tier": isVipPlus ? "vip_plus" : isVip ? "vip" : "free",
      "X-Model-Name": modelDisplayLabel({ isVipPlus, isVip }),
      ...tradeHintHeaders,
    },
  });
}

/**
 * 检测用户消息里是否提到了一笔交易，命中即返回 X-Trade-Hint 头。
 * - OPEN：直接返回检测到的开仓字段
 * - CLOSE：查用户最近一笔同 symbol 的 OPEN 交易，附 tradeId + 预估 PnL；
 *          若没有匹配的开仓交易，不发提示（避免对幻象交易显示卡片）
 */
async function buildTradeHintHeaders(
  userId: string,
  message: string,
): Promise<Record<string, string>> {
  const hit = detectTradeMention(message);
  if (!hit) return {};

  let payload: object;

  if (hit.intent === "OPEN") {
    payload = hit;
  } else {
    try {
      const open = await prisma.trade.findFirst({
        where: { userId, symbol: hit.symbol, status: "OPEN" },
        orderBy: { openedAt: "desc" },
        select: { id: true, direction: true, entryPrice: true, openedAt: true },
      });
      if (!open) return {};

      const pnlPct =
        open.direction === "LONG"
          ? ((hit.exitPrice - open.entryPrice) / open.entryPrice) * 100
          : ((open.entryPrice - hit.exitPrice) / open.entryPrice) * 100;

      payload = {
        intent: "CLOSE",
        tradeId: open.id,
        symbol: hit.symbol,
        direction: open.direction,
        entryPrice: open.entryPrice,
        exitPrice: hit.exitPrice,
        pnlPct: Number(pnlPct.toFixed(2)),
      };
    } catch (e) {
      console.error("[trade-hint] CLOSE lookup failed", e);
      return {};
    }
  }

  const b64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return { "X-Trade-Hint": b64 };
}
