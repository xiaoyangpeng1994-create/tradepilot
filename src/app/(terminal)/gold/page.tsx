import type { Metadata } from "next";
import { ChannelLanding } from "@/components/landing/ChannelLanding";

export const metadata: Metadata = {
  title: "黄金 AI 分析",
  description:
    "XAU/USD 黄金现货、PAXG ... 洞察AI · TradePilot 接入 Yahoo + Binance 双源行情，帮你解读黄金市场结构。",
};

export default function GoldPage() {
  return (
    <ChannelLanding
      title="黄金 AI 分析"
      subtitle="GOLD · XAU/USD"
      description="洞察AI · TradePilot 双源接入黄金现货行情（Yahoo GC=F + Binance PAXG），AI 副驾驶按 SMC/ICT 框架剖析关键 OB / FVG / 流动性位，陪你判断主力意图。"
      samplePrompts={[
        "XAU/USD 当前周线级别还有哪些未触发的流动性？",
        "近一周 SPDR 黄金 ETF 持仓变动暗示什么？",
        "中国央行连续增持对金价中长期意味着什么？",
        "美债实际收益率上行时如何看待多头持仓风险？",
      ]}
    />
  );
}
