import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  routedChatStream,
  isAnyModelAvailable,
  mockReply,
  modelDisplayLabel,
  type ChatHistoryItem,
  type TradingStyle,
} from "@/lib/model-router";
import { buildMarketContext } from "@/lib/market";
import { buildTraderProfile } from "@/lib/journal";
import { selectGuidanceSnippet } from "@/lib/guidance";
import { detectTradeMention } from "@/lib/trade-detection";
import { isProPlusLevel, COST_TEXT_PT, COST_IMAGE_PT } from "@/lib/pricing";
import { detectReplyMode, buildReplyModeBlock } from "@/lib/reply-mode";
import {
  getHistoryLimit,
  trimHistory,
  shouldGenerateSummary,
} from "@/lib/context-budget";

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
  // Context Budget：摘要相关字段（仅 ULTRA 使用）
  let sessionSummary: string | null = null;
  let sessionSummaryUpdatedAt: Date | null = null;
  let sessionMessageCountAtSummary = 0;

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

        const txTier = isVipPlusActive ? "vip_plus" : isVipActive ? "vip" : "free";

        const csSelect = {
          id: true,
          summary: true,
          summaryUpdatedAt: true,
          messageCountAtSummary: true,
        } as const;

        const existing = await tx.chatSession.findFirst({
          where: { userId, channel },
          orderBy: { updatedAt: "desc" },
          select: csSelect,
        });
        const cs =
          existing ??
          (await tx.chatSession.create({ data: { userId, channel }, select: csSelect }));

        // 取最近 N 条历史（按 tier 上限），在写入新 user 消息之前，按时间正序返回
        const recent = await tx.chatMessage.findMany({
          where: { sessionId: cs.id, role: { in: ["user", "assistant"] } },
          orderBy: { createdAt: "desc" },
          take: getHistoryLimit(txTier),
          select: { role: true, content: true },
        });
        const rawAsc = recent.reverse() as ChatHistoryItem[];
        // 过滤掉历史里"我不支持图片"等幻觉短语的 assistant 回复（防止模型自我强化）；
        // 同时把对应的上一条 user 消息也丢掉，避免悬空 user 让模型困惑。
        const filteredAsc = filterPoisonedHistory(rawAsc);
        // 再用 trimHistory 做最终截断（filterPoisonedHistory 可能减少条数，此处保持幂等）
        const historyAsc = trimHistory(filteredAsc, txTier);

        if (!isVipActive) {
          await tx.user.update({
            where: { id: userId },
            data: { computePts: { decrement: cost } },
          });
        }

        // 追问信号：若上一条 assistant 消息在 5 分钟内，给它的 followupCount +1
        // 这是判断"AI 没说清楚"的最轻量信号，无需额外 LLM 调用
        const FOLLOWUP_WINDOW_MS = 5 * 60 * 1000;
        const lastAssistant = await tx.chatMessage.findFirst({
          where: { sessionId: cs.id, role: "assistant" },
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true },
        });
        if (
          lastAssistant &&
          Date.now() - lastAssistant.createdAt.getTime() < FOLLOWUP_WINDOW_MS
        ) {
          await tx.chatMessage.update({
            where: { id: lastAssistant.id },
            data: { followupCount: { increment: 1 } },
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
          // Context Budget：传出摘要相关字段供后续注入
          sessionSummary: cs.summary ?? null,
          sessionSummaryUpdatedAt: cs.summaryUpdatedAt ?? null,
          sessionMessageCountAtSummary: cs.messageCountAtSummary,
        };
      });
      chatSessionId = result.sessionId;
      ptsBalanceAfter = result.balanceAfter;
      isVip = result.isVipActive;
      isVipPlus = result.isVipPlusActive;
      history = result.history;
      tradingStyle = result.tradingStyle ?? "SWING";
      sessionSummary = result.sessionSummary;
      sessionSummaryUpdatedAt = result.sessionSummaryUpdatedAt;
      sessionMessageCountAtSummary = result.sessionMessageCountAtSummary;
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
        if (!isAnyModelAvailable) {
          const text = mockReply(message);
          for (const ch of text) {
            controller.enqueue(encoder.encode(ch));
            acc += ch;
            await new Promise((r) => setTimeout(r, 6));
          }
        } else {
          const marketCtx = await buildMarketContext(channel, message, tradingStyle);
          // 登录用户拼上交易档案——按 tier 控制注入深度（匿名用户 0 token，FREE 最少，VIP/ULTRA 递进）
          const profileTier = isVipPlus ? "vip_plus" : isVip ? "vip" : "free";
          const traderProfile = userId
            ? await buildTraderProfile(userId, profileTier, tradingStyle)
            : "";

          // Guidance Layer：尝试注入 1 条产品教育/陪练 snippet（仅登录用户）
          let guidanceBlock = "";
          if (userId) {
            const [closedCount, openCount] = await Promise.all([
              prisma.trade.count({ where: { userId, status: "CLOSED" } }),
              prisma.trade.count({ where: { userId, status: "OPEN" } }),
            ]);
            const userMsgs = history
              .filter((h) => h.role === "user")
              .map((h) => h.content);
            const guidance = selectGuidanceSnippet({
              message,
              userId,
              userTurnCount: userMsgs.length + 1,
              totalClosedTrades: closedCount,
              hasOpenPosition: openCount > 0,
              recentUserMessages: userMsgs,
            });
            if (guidance) {
              guidanceBlock = `\n\n<guidance>${guidance.text}</guidance>`;
            }

            // Reply Mode：在 guidance 块之后追加回复模式指令
            const replyMode = detectReplyMode(message);
            const replyModeBlock = buildReplyModeBlock(replyMode, profileTier);
            if (replyModeBlock) {
              guidanceBlock += `\n\n<guidance>${replyModeBlock}</guidance>`;
            }
          }

          // Context Budget：ULTRA 且有摘要时，注入会话摘要到 extraSystem
          const summaryBlock =
            isVipPlus && sessionSummary
              ? `\n\n# 本会话摘要\n\n${sessionSummary}`
              : "";

          const fullCtx = `${marketCtx}${traderProfile ? `\n\n${traderProfile}` : ""}${guidanceBlock}${summaryBlock}`;
          for await (const delta of routedChatStream(message, {
            image,
            history,
            extraSystem: fullCtx,
            tier: isVipPlus ? "vip_plus" : isVip ? "vip" : "free",
            style: tradingStyle,
            userId,
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

          // Context Budget：判断是否需要生成摘要（本轮只打 log，不调用 generateSummary）
          const currentMessageCount = await prisma.chatMessage
            .count({ where: { sessionId: chatSessionId } })
            .catch(() => 0);
          const budgetTier = isVipPlus ? "vip_plus" : isVip ? "vip" : "free";
          const summaryCheck = shouldGenerateSummary(
            {
              summary: sessionSummary,
              summaryUpdatedAt: sessionSummaryUpdatedAt,
              messageCountAtSummary: sessionMessageCountAtSummary,
            },
            budgetTier,
            currentMessageCount,
          );
          if (summaryCheck.should) {
            console.log(
              `[context-budget] shouldGenerateSummary=true sessionId=${chatSessionId} reason=${summaryCheck.reason}`,
            );
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
  } else if (hit.intent === "ROUND_TRIP") {
    // 一句话内含完整 entry+exit，无需查历史 OPEN
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
