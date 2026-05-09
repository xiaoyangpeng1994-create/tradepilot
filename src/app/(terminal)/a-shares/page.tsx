import type { Metadata } from "next";
import { ChannelLanding } from "@/components/landing/ChannelLanding";

export const metadata: Metadata = {
  title: "A 股 AI 分析",
  description:
    "上证、深证、个股主力资金 ... 洞察AI · TradePilot 帮你解读 A 股结构与主力意图。",
};

export default function ASharesPage() {
  return (
    <ChannelLanding
      title="A 股 AI 分析"
      subtitle="A-SHARES"
      description="洞察AI · TradePilot 帮你拆解 A 股结构。从上证 / 深证指数到主力个股资金流向，AI 副驾驶按 SMC/ICT 框架陪你判断北向资金 + 主力意图。"
      samplePrompts={[
        "今天北向资金主要流入哪些板块？",
        "600519 茅台近期主力筹码是吸还是出？",
        "宁德时代（300750）这波回调结构上值不值得关注？",
        "近期龙虎榜哪些机构席位最活跃？",
      ]}
    />
  );
}
