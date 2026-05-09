/**
 * model-router.ts — OpenRouter 多模型路由层
 *
 * 职责：
 * 1. 灰度开关：ENABLED / ADMIN_IDS / ROLLOUT_PCT 三级控制
 * 2. 根据用户 tier 选择对应的 OpenRouter 模型
 * 3. 发起 OpenRouter 流式请求（SSE，与 OpenAI 格式完全兼容）
 * 4. 失败时自动 fallback 到 DashScope（qianwen.ts）
 * 5. Server console 输出完整诊断日志（绝不返回前端）
 *
 * 不做：
 * - 不修改 Prompt 体系（BASE_PERSONA / TIER_RULES 等仍在 qianwen.ts）
 * - 不向前端暴露真实模型名（Claude / GPT / Gemini / Qwen 等）
 * - 不改变 chatStream 的调用签名（opts 结构完全兼容）
 */

import {
  chatStream as dashscopeChatStream,
  buildSystemPromptExported,
  maxTokensForTier,
  pickModelForImage,
  type Tier,
  type TradingStyle,
  type ChatHistoryItem,
} from "./qianwen";
import { createHash } from "node:crypto";

// ── 环境变量 ────────────────────────────────────────────────────────────────

const OR_API_KEY   = process.env.OPENROUTER_API_KEY  ?? "";
const OR_BASE_URL  = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

/** 每个 tier 对应的 OpenRouter 真实模型名（仅 server 可见，绝不返回前端） */
const TIER_MODEL_ENV: Record<Tier, string> = {
  free:     process.env.OPENROUTER_FREE_MODEL  ?? "",
  vip:      process.env.OPENROUTER_VIP_MODEL   ?? "",
  vip_plus: process.env.OPENROUTER_ULTRA_MODEL ?? "",
};

// ── 灰度开关 ─────────────────────────────────────────────────────────────────

/**
 * OPENROUTER_ENABLED=true/false  — 总开关（默认 false，安全第一）
 * OPENROUTER_ADMIN_IDS=uid1,uid2 — 管理员白名单，命中即走 OpenRouter（忽略总开关）
 * OPENROUTER_ROLLOUT_PCT=0-100   — 非管理员灰度百分比（默认 0，不扩量）
 */
const OR_ENABLED     = (process.env.OPENROUTER_ENABLED ?? "false").toLowerCase() === "true";
const OR_ADMIN_IDS   = new Set(
  (process.env.OPENROUTER_ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
const OR_ROLLOUT_PCT = Math.min(
  100,
  Math.max(0, parseInt(process.env.OPENROUTER_ROLLOUT_PCT ?? "0", 10) || 0),
);

/**
 * shouldUseOpenRouter — 灰度判断
 *
 * 优先级：
 * 1. ADMIN_IDS 白名单命中 → 走 OpenRouter（无视总开关，方便管理员测试）
 * 2. ENABLED=false → 走 DashScope
 * 3. ENABLED=true + ROLLOUT_PCT > 0 → hash(userId) % 100 < PCT 走 OpenRouter
 * 4. 其余 → DashScope
 */
function shouldUseOpenRouter(userId?: string | null): {
  use: boolean;
  reason: "admin_whitelist" | "rollout" | "disabled" | "no_key" | "no_model";
} {
  // 没有 OR key，直接 DashScope
  if (!OR_API_KEY) return { use: false, reason: "no_key" };

  // 管理员白名单（无视总开关）
  if (userId && OR_ADMIN_IDS.has(userId)) {
    return { use: true, reason: "admin_whitelist" };
  }

  // 总开关关闭
  if (!OR_ENABLED) return { use: false, reason: "disabled" };

  // 灰度百分比（hash 稳定，同一用户每次结果一致）
  if (OR_ROLLOUT_PCT > 0 && userId) {
    const hash = parseInt(
      createHash("sha256").update(userId).digest("hex").slice(0, 8),
      16,
    );
    if (hash % 100 < OR_ROLLOUT_PCT) {
      return { use: true, reason: "rollout" };
    }
  }

  return { use: false, reason: "disabled" };
}

// ── 前端展示代号（永不暴露真实模型名）──────────────────────────────────────

const DISPLAY_LABEL: Record<Tier, string> = {
  free:     "TP-CORE",
  vip:      "TP-MAX",
  vip_plus: "TP-ULTRA",
};

// ── 可用性标志 ───────────────────────────────────────────────────────────────

export const openrouterAvailable = OR_API_KEY.length > 0;

/** isAnyModelAvailable：OpenRouter 或 DashScope 任一可用即为 true */
export const isAnyModelAvailable =
  openrouterAvailable ||
  (process.env.DASHSCOPE_API_KEY ?? "").length > 0;

// ── 类型 ─────────────────────────────────────────────────────────────────────

export type { Tier, TradingStyle, ChatHistoryItem };

export type ChatStreamOpts = {
  image?: string | null;
  history?: ChatHistoryItem[];
  extraSystem?: string;
  tier?: Tier;
  style?: TradingStyle;
  /** 传入 userId 用于灰度判断（匿名用户传 null/undefined） */
  userId?: string | null;
};

type OpenAIMessage =
  | { role: "system";    content: string }
  | { role: "user";      content: string | OpenAIContentPart[] }
  | { role: "assistant"; content: string };

type OpenAIContentPart =
  | { type: "text";      text: string }
  | { type: "image_url"; image_url: { url: string } };

// ── 核心：tier → 模型信息 ────────────────────────────────────────────────────

/**
 * getModelByTier — 最小 model selector
 *
 * 返回：
 * - model:        真实模型名（仅 server log，绝不返回前端）
 * - displayModel: TP-CORE / TP-MAX / TP-ULTRA（前端可见）
 * - provider:     "openrouter" | "dashscope"
 */
export function getModelByTier(
  tier: Tier,
  userId?: string | null,
): {
  model: string;
  displayModel: string;
  provider: "openrouter" | "dashscope";
  grayscaleReason: string;
} {
  const displayModel = DISPLAY_LABEL[tier];
  const { use, reason } = shouldUseOpenRouter(userId);

  if (use && TIER_MODEL_ENV[tier]) {
    return {
      model: TIER_MODEL_ENV[tier],
      displayModel,
      provider: "openrouter",
      grayscaleReason: reason,
    };
  }

  // 若 OR 应该用但模型未配置，记录原因
  const grayscaleReason = use && !TIER_MODEL_ENV[tier] ? "no_model" : reason;

  // fallback：DashScope 模型名（不暴露给前端，仅 server log）
  const dsModel = pickModelForImage(tier, false);
  return {
    model: dsModel,
    displayModel,
    provider: "dashscope",
    grayscaleReason,
  };
}

// ── OpenRouter SSE 流（内部） ─────────────────────────────────────────────────

/**
 * openrouterStream — 向 OpenRouter 发起流式请求并 yield token
 *
 * SSE 格式与 DashScope compatible-mode 完全一致：
 *   data: {"choices":[{"delta":{"content":"..."}}]}
 *   data: [DONE]
 */
async function* openrouterStream(
  model: string,
  messages: OpenAIMessage[],
  maxTokens: number,
): AsyncGenerator<string> {
  const endpoint = `${OR_BASE_URL}/chat/completions`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OR_API_KEY}`,
      "Content-Type": "application/json",
      // OpenRouter 推荐头（用于统计，不影响功能）
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://tradepilot.ai",
      "X-Title": "TradePilot",
    },
    body: JSON.stringify({
      model,
      stream: true,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
  }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const json  = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        // 某些模型（如 Gemini via OpenRouter）delta 可能为 null，需过滤
        if (typeof delta === "string" && delta) yield delta;
      } catch {
        // 跳过非 JSON / 心跳行
      }
    }
  }
}

// ── 主路由入口 ───────────────────────────────────────────────────────────────

/**
 * routedChatStream — 对外暴露的统一流式入口
 *
 * 签名与原 chatStream() 完全兼容，route.ts 只需改 import + 传入 userId。
 *
 * 路由逻辑：
 * 1. userId 在 ADMIN_IDS 白名单 → OpenRouter（无视总开关）
 * 2. ENABLED=false → DashScope
 * 3. ENABLED=true + hash(userId) % 100 < ROLLOUT_PCT → OpenRouter
 * 4. OpenRouter 请求失败 → fallback DashScope
 * 5. OR key 不存在 → 直接 DashScope
 *
 * 图片请求特殊处理：
 * - hasImage=true 时，若 OpenRouter 模型不支持视觉，自动 fallback DashScope vl 模型
 */
export async function* routedChatStream(
  message: string,
  opts?: ChatStreamOpts,
): AsyncGenerator<string> {
  const tier     = opts?.tier    ?? "free";
  const style    = opts?.style   ?? "SWING";
  const image    = opts?.image;
  const hasImage = !!image;
  const userId   = opts?.userId  ?? null;

  const t0 = Date.now();

  const { model, displayModel, provider, grayscaleReason } = getModelByTier(tier, userId);
  const maxTokens = maxTokensForTier(tier);

  // ── Server console 日志（仅 server 端，绝不返回前端）──────────────────────
  // 真实模型名（model）只出现在这里，不写入任何 HTTP 响应
  console.log(
    `[model-router] userId=${userId ?? "anon"} | grayscale=${grayscaleReason} | tier=${tier} | displayModel=${displayModel} | provider=${provider} | model=${model}`,
  );

  // ── 尝试 OpenRouter ──────────────────────────────────────────────────────
  if (provider === "openrouter") {
    try {
      // 构建 system prompt（复用 qianwen.ts 的 buildSystemPromptExported，Prompt 内容不动）
      const systemContent = buildSystemPromptExported(tier, style, opts?.extraSystem);

      // 构建 messages 数组
      const history = (opts?.history ?? []).map((h) => ({
        role:    h.role as "user" | "assistant",
        content: h.content,
      }));

      const userContent: string | OpenAIContentPart[] = hasImage
        ? [
            { type: "text"      as const, text: message },
            { type: "image_url" as const, image_url: { url: image! } },
          ]
        : message;

      const messages: OpenAIMessage[] = [
        { role: "system", content: systemContent },
        ...history,
        { role: "user",   content: userContent },
      ];

      yield* openrouterStream(model, messages, maxTokens);

      // 成功日志
      console.log(
        `[model-router] ✓ openrouter stream done | userId=${userId ?? "anon"} | tier=${tier} | displayModel=${displayModel} | fallbackUsed=false | latencyMs=${Date.now() - t0}`,
      );
      return;
    } catch (err) {
      const fallbackReason = (err as Error).message.slice(0, 160);
      // fallback 日志
      console.error(
        `[model-router] ✗ openrouter failed → dashscope fallback | userId=${userId ?? "anon"} | tier=${tier} | displayModel=${displayModel} | fallbackUsed=true | fallbackReason=${fallbackReason} | latencyMs=${Date.now() - t0}`,
      );
      // 继续执行下方 DashScope fallback
    }
  }

  // ── DashScope fallback（或直接路由）────────────────────────────────────
  yield* dashscopeChatStream(message, {
    image,
    history:     opts?.history,
    extraSystem: opts?.extraSystem,
    tier,
    style,
  });

  console.log(
    `[model-router] ✓ dashscope stream done | userId=${userId ?? "anon"} | tier=${tier} | displayModel=${displayModel} | fallbackUsed=${provider === "openrouter"} | latencyMs=${Date.now() - t0}`,
  );
}

// ── 重新导出 qianwen.ts 的工具函数（route.ts 无需改 import 路径）──────────

export { modelDisplayLabel, mockReply, qianwenAvailable } from "./qianwen";
