import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ForexPage() {
  return (
    <>
      <PageHeader title="外汇流动性窗口" badge="PENG_GE_AI CORE V4.1" />
      <ChatWindow
        channel="forex"
        intro={`外汇流动性窗口已激活，底层算力全量调拨至 Gemini 1.5 Pro 核心引擎。我正在追踪主要货币对在高周期的流动性失衡（FVG）与止损扫单行为。你可以随时通过聊天问我任何货币对的走势，我不仅能实时监测机构订单流，还能为你提供基于顶级大模型的深度观点校准，让我们聊聊你的下一笔交易计划。`}
      />
    </>
  );
}
