/**
 * context-budget.ts — Context Budget Manager 纯函数层
 *
 * 职责：
 * 1. getHistoryLimit(tier)         — 按 tier 返回历史消息条数上限
 * 2. trimHistory(messages, tier)   — 截断历史消息至 tier 上限
 * 3. shouldGenerateSummary(...)    — 判断是否需要为 ULTRA 生成摘要
 * 4. buildConversationSummaryPrompt(messages) — 生成摘要用 prompt
 *
 * 不做：
 * - 不调用 LLM（generateSummary 暂不实现）
 * - 不引入 tokenizer / token 估算
 * - 不修改 schema / route / qianwen / model-router / UI
 */

import type { Tier } from "./qianwen";

// ── 类型定义 ──────────────────────────────────────────────────────────────────

/** 与 qianwen.ts ChatHistoryItem 保持一致的最小结构 */
export interface BudgetMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * ChatSession 中与 Context Budget 相关的字段子集。
 * 与 prisma/schema.prisma ChatSession 字段对应，不引入 Prisma 类型依赖。
 */
export interface SessionBudgetInfo {
  summary: string | null;
  summaryUpdatedAt: Date | null;
  messageCountAtSummary: number;
}

// ── 1. getHistoryLimit ────────────────────────────────────────────────────────

/**
 * 按 tier 返回历史消息条数上限。
 *
 * FREE     → 4 条（短答观察型，控制 token 成本）
 * VIP      → 8 条（结构化深度，适度上下文）
 * VIP_PLUS → 6 条（ULTRA 依赖摘要补偿，窗口反而收窄）
 */
export function getHistoryLimit(tier: Tier): number {
  switch (tier) {
    case "free":
      return 4;
    case "vip":
      return 8;
    case "vip_plus":
      return 6;
    default: {
      // TypeScript exhaustive check 兜底
      const _exhaustive: never = tier;
      void _exhaustive;
      return 4;
    }
  }
}

// ── 2. trimHistory ────────────────────────────────────────────────────────────

/**
 * 按 tier 截断历史消息，保留最近 N 条。
 *
 * 规则：
 * - 取 getHistoryLimit(tier) 作为 N
 * - 从数组末尾取最近 N 条（保留最新上下文）
 * - 不做 token 估算，不引入 tokenizer
 *
 * @param messages 完整历史消息数组（按时间升序）
 * @param tier     用户 tier
 * @returns        截断后的消息数组（原数组的浅拷贝切片）
 */
export function trimHistory(messages: BudgetMessage[], tier: Tier): BudgetMessage[] {
  const limit = getHistoryLimit(tier);
  if (messages.length <= limit) {
    return messages.slice();
  }
  return messages.slice(messages.length - limit);
}

// ── 3. shouldGenerateSummary ──────────────────────────────────────────────────

/** shouldGenerateSummary 的返回结构，便于调用方记录触发原因 */
export interface ShouldGenerateSummaryResult {
  should: boolean;
  reason: "not_ultra" | "below_threshold" | "message_delta" | "time_expired" | null;
}

/**
 * 判断是否需要为当前会话生成摘要。
 *
 * 只对 ULTRA (vip_plus) 生效。
 *
 * 触发条件（满足其一即触发）：
 * A. currentMessageCount > 20
 *    AND currentMessageCount - session.messageCountAtSummary >= 10
 *
 * B. session.summaryUpdatedAt 超过 24 小时
 *
 * @param session             会话摘要相关字段
 * @param tier                用户 tier
 * @param currentMessageCount 当前会话消息总数
 * @param now                 当前时间（默认 new Date()，便于单测注入）
 */
export function shouldGenerateSummary(
  session: SessionBudgetInfo,
  tier: Tier,
  currentMessageCount: number,
  now: Date = new Date(),
): ShouldGenerateSummaryResult {
  // 只对 ULTRA 生效
  if (tier !== "vip_plus") {
    return { should: false, reason: "not_ultra" };
  }

  // 条件 A：消息数超过阈值 且 自上次摘要后新增 >= 10 条
  const TOTAL_THRESHOLD = 20;
  const DELTA_THRESHOLD = 10;

  if (
    currentMessageCount > TOTAL_THRESHOLD &&
    currentMessageCount - session.messageCountAtSummary >= DELTA_THRESHOLD
  ) {
    return { should: true, reason: "message_delta" };
  }

  // 条件 B：summaryUpdatedAt 超过 24 小时
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

  if (
    session.summaryUpdatedAt !== null &&
    now.getTime() - session.summaryUpdatedAt.getTime() > TWENTY_FOUR_HOURS_MS
  ) {
    return { should: true, reason: "time_expired" };
  }

  return { should: false, reason: "below_threshold" };
}

// ── 4. buildConversationSummaryPrompt ─────────────────────────────────────────

/**
 * 生成用于摘要的 prompt 字符串。
 *
 * 要求：
 * - 只总结本会话事实（用户问了什么、AI 分析了什么市场/结构）
 * - 不添加交易建议
 * - 不推测用户心理
 * - 不生成新判断
 * - 输出 200 字以内中文摘要
 *
 * @param messages 需要被摘要的消息列表（按时间升序）
 * @returns        完整的摘要 prompt 字符串
 */
export function buildConversationSummaryPrompt(messages: BudgetMessage[]): string {
  const conversationText = messages
    .map((m) => {
      const roleLabel = m.role === "user" ? "用户" : "AI";
      return `${roleLabel}：${m.content}`;
    })
    .join("\n\n");

  return `以下是一段交易分析对话记录。请生成一段 200 字以内的中文摘要，仅描述本次对话中出现的客观事实（用户询问了哪些市场/品种/结构，AI 提到了哪些关键价位或结构观察）。

要求：
- 只总结本会话中已出现的事实，不添加新判断
- 不添加任何交易建议或操作指引
- 不推测用户的心理状态或意图
- 不生成对话中未提及的结论
- 输出纯中文，200 字以内

对话记录：
${conversationText}

摘要：`;
}

// ── 5. generateSummary（暂不实现）────────────────────────────────────────────

/**
 * generateSummary — 调用 LLM 生成摘要。
 *
 * 本轮暂不实现，占位声明供后续 Commit 接入。
 * 调用方不应在当前版本调用此函数。
 */
export async function generateSummary(
  _messages: BudgetMessage[],
  _tier: Tier,
): Promise<string> {
  throw new Error(
    "[context-budget] generateSummary 尚未实现，请等待后续 Commit 接入 LLM 调用。",
  );
}
