import { PageHeader } from "@/components/layout/PageHeader";
import { TwitterClient, type Signal } from "./TwitterClient";

const SIGNALS: Signal[] = [
  {
    id: "smc_signals_1",
    name: "SMC 大师 - P哥",
    handle: "smc_signals",
    avatarLetter: "S",
    avatarBg: "bg-accent-info/20 text-accent-info",
    timeAgo: "2 分钟前",
    content:
      "BTC/USD 正在接近主要的 H4 供应区 (64200-64500)。M15 级别可见结构转变 (MSB)，结构倾向偏空，等待 M15 二次确认。 #交易 #SMC",
    asset: "BTC/USD",
    comments: 12,
    retweets: 48,
  },
  {
    id: "tradingview_1",
    name: "TradingView 官方",
    handle: "tradingview",
    avatarLetter: "T",
    avatarBg: "bg-accent-purple/20 text-accent-purple",
    timeAgo: "15 分钟前",
    content:
      "市场正在屏息以待今日晚些时候的 FOMC 利率决议。预计美元指数相关货币对将出现剧烈波动。",
    asset: "DXY",
    comments: 12,
    retweets: 48,
  },
  {
    id: "liq_hunter_1",
    name: "流动性猎手",
    handle: "liq_hunter",
    avatarLetter: "流",
    avatarBg: "bg-accent-neon/20 text-accent-neon",
    timeAgo: "45 分钟前",
    content:
      "EUR/AUD 流动性扫损已在 1.6234 确认。潜在目标本周高点；结构失效参考：当前影线下方。",
    asset: "EUR/AUD",
    comments: 12,
    retweets: 48,
  },
  {
    id: "glassnode_1",
    name: "Glassnode 数据终端",
    handle: "glassnode",
    avatarLetter: "G",
    avatarBg: "bg-accent-gold/20 text-accent-gold",
    timeAgo: "1 小时前",
    content:
      "链上数据显示大量资金正流入冷钱包。看涨情绪依然强劲，机构吸筹迹象明显。",
    asset: "BTC",
    comments: 12,
    retweets: 48,
  },
];

export default function TwitterPage() {
  return (
    <>
      <PageHeader
        title="X 大神追踪"
        badge="ALPHA 信号监测系统 · 毫秒级同步"
      />
      <TwitterClient signals={SIGNALS} />
    </>
  );
}
