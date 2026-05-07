import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ForexPage() {
  return (
    <>
      <PageHeader title="外汇流动性窗口" badge="PENG_GE_AI CORE V4.1" />
      <ChatWindow
        channel="forex"
        suggestions={[
          "EUR/USD 当前 H4 是否处于 SMC 供应区？",
          "美元指数走强对黄金/原油有什么联动？",
          "USD/JPY 突破 155 后最近的流动性目标在哪？",
          "本周 FOMC 决议对外汇的潜在影响怎么布局？",
        ]}
      />
    </>
  );
}
