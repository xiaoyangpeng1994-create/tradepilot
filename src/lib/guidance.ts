/**
 * Guidance Layer：每次对话尝试注入 1 条产品教育/陪练 snippet。
 *
 * 设计原则（已和 P1.2 (c) 合并）：
 * - 场景命中优先（按优先级树，命中即返）
 * - 都不命中时，每第 5 个用户 turn 兜底一次教学型 snippet
 * - 仅登录用户接受 guidance（匿名用户跳过）
 * - 一次对话最多 1 条 guidance
 * - 不引入第二次 LLM 调用
 *
 * snippet 文本是给 AI 的指令（包在 <guidance>...</guidance> 里），AI 在合适处
 * 自然消化为 1-2 句话。BASE_PERSONA 里有"如何处理 <guidance>"的总规则。
 */
import { detectMarketFromMessage } from "./detect-market";

export type GuidanceContext = {
  message: string;
  userId: string; // 仅登录用户用 guidance（匿名跳过）
  /** 包含本次在内的用户 turn 序号（第 1 / 2 / 3...） */
  userTurnCount: number;
  totalClosedTrades: number;
  hasOpenPosition: boolean;
  /** 本会话历史中所有 user 消息的 content（不含本次） */
  recentUserMessages: string[];
};

export type Guidance = {
  id: string;
  text: string;
};

const G1: Guidance = {
  id: "G1",
  text: `用户最近多轮聊结构但都没附图。在回答末段轻邀请一句——"如果方便，下次截一张当前 K 线图，TradePilot 会结合图表位置 + 你的交易风格给更具体的判断"。一次足够、不催促。`,
};
const G2: Guidance = {
  id: "G2",
  text: `用户提到了交易亏损/失利。在回答末段加一句温和提示——"把这笔保存到交易画像吧。长期记录后，TradePilot 能慢慢识别你在哪些情况下更容易冲动交易"。不评价、不说教。`,
};
const G3: Guidance = {
  id: "G3",
  text: `用户本会话内在多个市场之间切换关注。合适处加一句——"你最近在多个市场都有关注。持续记录后，TradePilot 会识别哪些 setup 在哪个市场更适合你"。不要列具体市场名。`,
};
const G4: Guidance = {
  id: "G4",
  text: `用户已开始记录交易但样本还少（<3 笔已平仓）。合适处单句点出价值——"TradePilot 的交易画像不是流水。再积累几笔，AI 就能识别你的优势 setup、高风险时段、亏损习惯"。仅当本次回答与画像/交易相关时使用。`,
};
const G6: Guidance = {
  id: "G6",
  text: `用户当前有未平仓持仓且本次问题涉及"平/出/止盈/止损"。合适处加一句——"你目前还有持仓，记得复查关键位是否仍有效"。不催促平仓、不下决定。`,
};
const G7: Guidance = {
  id: "G7",
  text: `用户已陪伴多轮对话。在合适处单句轻提一下——"你和 TradePilot 聊了不少了——记得把讨论过的交易保存到画像，AI 会用这些数据慢慢识别你的判断模式"。仅一次、不强推、不像广告。`,
};

const LOSS_RE = /亏|输了|套牢?|割肉|爆仓|后悔|踏空/;
const POSITION_QUERY_RE = /平仓?|出仓|止盈|止损|要不要|该不该|可以.*平|考虑.*平/;
const STRUCTURE_RE = /结构|趋势|支撑|阻力|\bOB\b|\bFVG\b|流动性|关注区/i;

export function selectGuidanceSnippet(ctx: GuidanceContext): Guidance | null {
  const msg = ctx.message;

  // G2 亏损（最高优先级——情绪状态）
  if (LOSS_RE.test(msg)) return G2;

  // G6 持仓 + 平仓询问
  if (ctx.hasOpenPosition && POSITION_QUERY_RE.test(msg)) return G6;

  // G3 多市场观察（命中 ≥2 个不同 market）
  const allMessages = [msg, ...ctx.recentUserMessages];
  const markets = new Set<string>();
  for (const m of allMessages) {
    const market = detectMarketFromMessage(m);
    if (market) markets.add(market);
  }
  if (markets.size >= 2) return G3;

  // G4 画像价值教学（用户开始记录但样本少）
  if (ctx.totalClosedTrades >= 1 && ctx.totalClosedTrades < 3) return G4;

  // G1 上传引导（≥3 turn + 当前问结构 + 历史无图能体感不强，简化为只看 turn+keyword）
  if (ctx.userTurnCount >= 3 && STRUCTURE_RE.test(msg)) return G1;

  // G7 turn-counter 兜底（第 5/10/15... turn 触发）
  if (ctx.userTurnCount > 0 && ctx.userTurnCount % 5 === 0) return G7;

  return null;
}
