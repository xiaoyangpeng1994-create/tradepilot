import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";

export default function ASharesPage() {
  return (
    <>
      <PageHeader title="A 股主力透视" badge="NORTHBOUND TRACKER" />
      <ChatWindow
        channel="a-shares"
        intro={`A 股主力透视通道已激活。我会监控北向资金、龙虎榜机构席位、融资融券异动以及板块资金轮动。你可以问我个股（如 600519 / 300750）的主力筹码结构、行业景气度、北向加减仓信号。`}
        placeholder="询问 A 股 / 板块 / 北向资金..."
      />
    </>
  );
}
