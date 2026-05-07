import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";

export default function GoldPage() {
  return (
    <>
      <PageHeader title="黄金专属终端" badge="XAU/USD ENGINE" />
      <ChatWindow
        channel="gold"
        placeholder="询问黄金行情或上传 XAU/USD K 线..."
        suggestions={[
          "XAU/USD 当前周线级别还有哪些未触发的流动性？",
          "近一周 SPDR 黄金 ETF 持仓变动暗示什么？",
          "中国央行连续增持对金价中长期意味着什么？",
          "美债实际收益率上行时该如何对冲多头？",
        ]}
      />
    </>
  );
}
