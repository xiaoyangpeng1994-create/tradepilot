import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";

export default function UsStocksPage() {
  return (
    <>
      <PageHeader title="美股主力追踪" badge="NASDAQ / NYSE FLOW" />
      <ChatWindow
        channel="us"
        intro={`美股主力追踪通道已激活。我正在解析 NASDAQ-100 与 SPX 成分股的暗池交易、机构 13F 持仓变动以及期权 GEX/DEX 数据。你可以问我个股（AAPL/NVDA/TSLA 等）的多周期共振分析、风险敞口与对冲建议。`}
        placeholder="询问个股 / 指数 / 行业板块..."
      />
    </>
  );
}
