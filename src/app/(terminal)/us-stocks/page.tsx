import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";

export default function UsStocksPage() {
  return (
    <>
      <PageHeader title="美股主力追踪" badge="NASDAQ / NYSE FLOW" />
      <ChatWindow
        channel="us"
        placeholder="询问个股 / 指数 / 行业板块..."
        suggestions={[
          "NVDA 财报后期权 GEX 重心移到哪里了？",
          "TSLA 当前 Pinbar 形态有效吗？给个交易计划",
          "SPX 0DTE 流动性近期是否在堆积空头？",
          "AAPL 上方暗池成交集中区在哪一档？",
        ]}
      />
    </>
  );
}
