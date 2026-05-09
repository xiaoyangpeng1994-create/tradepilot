import type { Metadata } from "next";
import { ChannelLanding } from "@/components/landing/ChannelLanding";

export const metadata: Metadata = {
  title: "外汇 AI 分析",
  description:
    "EUR/USD、USD/JPY、DXY ... 洞察AI · TradePilot 帮你解读外汇市场结构与流动性。",
};

export default function ForexPage() {
  return (
    <ChannelLanding
      title="外汇 AI 分析"
      subtitle="FOREX"
      description="洞察AI · TradePilot 帮你拆解外汇市场结构。从 EUR/USD 流动性扫损到 USD/JPY 多周期共振，AI 副驾驶接入实时报价 + SMC/ICT 框架，陪你看懂主力意图。"
      samplePrompts={[
        "EUR/USD 当前 H4 是否处于 SMC 供应区？",
        "美元指数走强对黄金/原油有什么联动？",
        "USD/JPY 突破 155 后最近的流动性目标在哪？",
        "本周 FOMC 决议对外汇的潜在影响怎么解读？",
      ]}
    />
  );
}
