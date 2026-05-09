/**
 * P2.3 AI 回复模式检测 + guidance 块构建
 *
 * 三种模式：
 * - DECISION_SHORT：决策敏感短答（要不要平仓 / 怎么办 / 还能拿吗）
 * - DAILY_PLAN：今日交易观察计划（今天怎么看 / 给我计划）
 * - DEEP_ANALYSIS：深度分析（完整分析 / 多周期 / 深度复盘）
 *
 * 注入方式：追加到现有 <guidance> 块，不引入新标签。
 * 优先级：DECISION_SHORT > DAILY_PLAN > DEEP_ANALYSIS > null（不注入）
 */

export type ReplyMode = "DECISION_SHORT" | "DAILY_PLAN" | "DEEP_ANALYSIS" | null;

// ─── Intent 正则 ──────────────────────────────────────────────────────────────

/** 决策敏感：用户在问"要不要 / 怎么办 / 还能拿吗" */
const DECISION_RE =
  /要不要|该不该|能不能|怎么办|还能拿|可以.*平|要不要.*出|危险吗|安全吗|还有救|要不要跑|要不要止|要不要加|要不要减|要不要平|要不要买|要不要卖|还拿着|还持着|要出吗|要跑吗/;

/** 今日计划：用户在要今天的交易观察计划 */
const DAILY_PLAN_RE =
  /今天.*计划|今日.*计划|今天.*怎么看|今天.*重点|给我.*计划|今天.*怎么做|今天.*操作|今天.*交易|今天.*看哪|今天.*关注/;

/** 深度分析：用户明确要求完整 / 多周期 / 深度 */
const DEEP_ANALYSIS_RE =
  /完整分析|多周期|深度复盘|路径推演|详细拆解|全面分析|系统分析|帮我分析一下|深入分析|完整.*分析|详细.*分析/;

// ─── 检测函数 ─────────────────────────────────────────────────────────────────

/**
 * 检测用户消息对应的回复模式。
 * 优先级：DECISION_SHORT > DAILY_PLAN > DEEP_ANALYSIS > null
 */
export function detectReplyMode(message: string): ReplyMode {
  if (DECISION_RE.test(message)) return "DECISION_SHORT";
  if (DAILY_PLAN_RE.test(message)) return "DAILY_PLAN";
  if (DEEP_ANALYSIS_RE.test(message)) return "DEEP_ANALYSIS";
  return null;
}

// ─── Guidance 块构建 ──────────────────────────────────────────────────────────

type Tier = "free" | "vip" | "vip_plus";

/**
 * 根据回复模式 + 会员档位，构建注入 <guidance> 的文本。
 * 返回空字符串表示不注入。
 */
export function buildReplyModeBlock(mode: ReplyMode, tier: Tier): string {
  if (!mode) return "";

  switch (mode) {
    case "DECISION_SHORT":
      return buildDecisionShort(tier);
    case "DAILY_PLAN":
      return buildDailyPlan(tier);
    case "DEEP_ANALYSIS":
      return buildDeepAnalysis(tier);
  }
}

// ─── DECISION_SHORT ───────────────────────────────────────────────────────────

function buildDecisionShort(tier: Tier): string {
  // 所有档位都给短答，差异在内容深度
  const base = `用户在问一个需要判断的问题。请用短答回应，最多 5 句话：
- 给出 1-2 个关键位置（上方压力 / 下方支撑），必须有具体数字
- 说明"守住了怎样 / 跌破了怎样"
- 不给入场、止损、止盈建议
- 不写执行清单，不写长报告
- 不说"建议你"、"你应该"、"你需要"`;

  if (tier === "free") {
    return (
      base +
      `\n- 给出 1 个最关键的位置即可
- 末尾用一句话自然提示：开启 TP-MAX 后可以看持仓风险判断和更多关键位置`
    );
  }

  if (tier === "vip") {
    return (
      base +
      `\n- 给出上方压力 + 下方支撑各 1 个
- 加一句持仓风险判断（如果用户有持仓相关问题）`
    );
  }

  // vip_plus
  return (
    base +
    `\n- 给出上方压力 + 下方支撑各 1 个
- 如果会话历史中有用户的交易记录，引用一句相关模式
- 加一句持仓风险判断`
  );
}

// ─── DAILY_PLAN ───────────────────────────────────────────────────────────────

function buildDailyPlan(tier: Tier): string {
  if (tier === "free") {
    return `用户在要今日交易观察计划。FREE 档只给简版：
- 告诉用户今天最重要的 1 个关键位置
- 说明"守住了怎样 / 跌破了怎样"
- 末尾用一句话自然提示：开启 TP-MAX 后可以看完整的今日计划（含三种路径）
- 不写完整四段结构`;
  }

  const fullPlan = `用户在要今日交易观察计划。请按以下四段结构回答：

1. 今天先看什么（1 句话，说明今天最重要的关注点）
2. 今日关键位置
   - 上方压力：XX（到这里先观察，过不去容易回落）
   - 下方支撑：XX（守住了方向还稳，跌破了风险变大）
   - 容易插针：XX 附近（这里容易先扫一下再反向）
3. 三种路径
   - 路径 A（往上走）：站上 XX 并站稳，上方空间打开，下一个关注位置在 XX
   - 路径 B（横盘震荡）：在 XX 到 XX 之间来回，先等方向确认
   - 路径 C（往下走）：跌破 XX，风险会变大，下方关注 XX
4. 今天最重要一句话（1 句，先看价格在哪里怎么反应）

规则：路径只描述可能性，不推荐哪条。不说入场/止损/止盈/胜率。`;

  if (tier === "vip") {
    return fullPlan;
  }

  // vip_plus：加多周期说明
  return (
    fullPlan +
    `\n\n补充（TP-ULTRA）：在第 2 段关键位置之前，加一句大周期（日线/周线）方向说明，说明大周期和小周期方向是否一致。`
  );
}

// ─── DEEP_ANALYSIS ────────────────────────────────────────────────────────────

function buildDeepAnalysis(tier: Tier): string {
  if (tier === "free") {
    return `用户要求深度分析。FREE 档不展开完整分析：
- 给出 1 个最关键的位置
- 说明"守住了怎样 / 跌破了怎样"
- 用一句话自然提示：完整的深度分析需要 TP-MAX，包含多周期结构和三种路径推演`;
  }

  const base = `用户要求深度分析。请展开以下内容：
- 大周期结构（日线/周线方向，说明方向是否明确）
- 小周期关键位置（4小时/1小时，给出上方压力 + 下方支撑）
- 三种路径（路径 A 往上走 / 路径 B 横盘 / 路径 C 往下走，各给下一个关注位置）
- 如果用户有持仓相关问题，加持仓风险拆解

规则：不说入场/止损/止盈/胜率/仓位比例。路径只描述可能性，不推荐哪条。不说"建议你"。`;

  if (tier === "vip") {
    return base;
  }

  // vip_plus：加交易画像关联
  return (
    base +
    `\n\n补充（TP-ULTRA）：如果会话历史或交易画像中有相关记录，在分析末段引用一句用户的历史交易模式，说明这次情况和之前的关联。`
  );
}
