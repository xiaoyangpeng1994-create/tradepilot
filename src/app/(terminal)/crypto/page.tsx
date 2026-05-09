import type { Metadata } from "next";
import { ChannelLanding } from "@/components/landing/ChannelLanding";

export const metadata: Metadata = {
  title: "加密 AI 分析",
  description:
    "BTC、ETH、SOL ... 洞察AI · TradePilot 接入 Binance 实时行情 + K 线结构识别，帮你解读加密市场。",
};

export default function CryptoPage() {
  return (
    <ChannelLanding
      title="加密 AI 分析"
      subtitle="CRYPTO · BINANCE LIVE"
      description="洞察AI · TradePilot 接入 Binance 现货行情与 K 线结构识别（OB / FVG / 流动性位算法计算），AI 副驾驶帮你判断主流币当前结构倾向，陪你看懂主力订单流。"
      samplePrompts={[
        "BTC 当前 H4 结构倾向偏多还是偏空？",
        "ETH/BTC 比值跌破近期支撑代表什么？",
        "Solana 生态币近期有哪些资金异动？",
        "如何用 SMC 框架判断 BTC 这次回撤是不是骗炮？",
      ]}
    />
  );
}
