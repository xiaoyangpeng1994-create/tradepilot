/**
 * 极简关键词识别——把用户消息映射到一个市场频道。
 *
 * 设计原则：
 * - 不引入任何 NLP / 第二次 LLM 调用
 * - 词典短而保守，宁漏勿错
 * - 优先级显式（数组顺序）：crypto > gold > forex > us-stocks > a-shares
 *   特定币 / 特定金属 比 "外汇 / 美股" 类目更确定
 * - 用 \b 词边界防误匹（"以太坊" 不会因为含"以太"被吃掉、"abtc" 不被当 BTC）
 */

export type DetectedMarket =
  | "crypto"
  | "gold"
  | "forex"
  | "us-stocks"
  | "a-shares"
  | null;

const PATTERNS: Array<{ market: Exclude<DetectedMarket, null>; words: RegExp[] }> = [
  {
    market: "crypto",
    words: [
      /\bbtc\b/i,
      /\beth\b/i,
      /\bsol\b/i,
      /\bbnb\b/i,
      /\bxrp\b/i,
      /\bdoge\b/i,
      /bitcoin/i,
      /ethereum/i,
      /\busdt\b/i,
      /比特币/,
      /以太坊?/,
      /加密(货币)?/,
      /数字货币/,
      /链上/,
    ],
  },
  {
    market: "gold",
    words: [/黄金/, /\bxau(usd)?\b/i, /\bgc=?f?\b/i, /金价/, /paxg/i],
  },
  {
    market: "forex",
    words: [
      /外汇/,
      /\beur(usd|\/usd)?\b/i,
      /\bgbp(usd|\/usd)?\b/i,
      /\busd(jpy|\/jpy)?\b/i,
      /\baud(usd|\/usd)?\b/i,
      /\bnzd(usd|\/usd)?\b/i,
      /\busd(chf|\/chf)?\b/i,
      /\busd(cad|\/cad)?\b/i,
      /\bdxy\b/i,
      /美元指数/,
      /欧元(兑|对)?/,
      /日元(兑|对)?/,
      /英镑(兑|对)?/,
    ],
  },
  {
    market: "us-stocks",
    words: [
      /美股/,
      /纳指/,
      /标普/,
      /道指/,
      /\bspx\b/i,
      /\bspy\b/i,
      /\bqqq\b/i,
      /\bnvda\b/i,
      /\baapl\b/i,
      /\btsla\b/i,
      /\bmsft\b/i,
      /\bgoogl?\b/i,
      /\bamzn\b/i,
      /\bmeta\b/i,
      /tesla/i,
      /apple/i,
      /nvidia/i,
      /microsoft/i,
    ],
  },
  {
    market: "a-shares",
    words: [
      /[Aa]\s*股/,
      /上证/,
      /深证/,
      /沪深/,
      /创业板/,
      /科创板/,
      /北向(资金)?/,
      // 6 位股票代码：沪 6 / 深 0 / 创业板 3 开头
      /\b[036]\d{5}\b/,
    ],
  },
];

export function detectMarketFromMessage(message: string): DetectedMarket {
  if (!message) return null;
  for (const { market, words } of PATTERNS) {
    if (words.some((re) => re.test(message))) return market;
  }
  return null;
}
