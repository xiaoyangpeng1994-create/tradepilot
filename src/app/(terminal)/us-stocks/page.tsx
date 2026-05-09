import type { Metadata } from "next";
import { ChannelLanding } from "@/components/landing/ChannelLanding";

export const metadata: Metadata = {
  title: "美股 AI 分析",
  description:
    "纳指、标普、个股 ... 洞察AI · TradePilot 帮你解读美股结构与宏观联动。",
};

export default function UsStocksPage() {
  return (
    <ChannelLanding
      title="美股 AI 分析"
      subtitle="US STOCKS"
      description="洞察AI · TradePilot 帮你拆解美股结构。从纳指 / 标普指数级走势到主力个股资金流，AI 副驾驶按 SMC/ICT 框架陪你看懂宏观与微观的联动。"
      samplePrompts={[
        "NVDA 财报后期权 GEX 重心移到哪里了？",
        "TSLA 当前 Pinbar 形态结构倾向是什么？",
        "SPX 0DTE 流动性近期是否在堆积空头？",
        "AAPL 上方暗池成交集中区在哪一档？",
      ]}
    />
  );
}
