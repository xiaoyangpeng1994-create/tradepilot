import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";

export default function GoldPage() {
  return (
    <>
      <PageHeader title="黄金专属终端" badge="XAU/USD ENGINE" />
      <ChatWindow
        channel="gold"
        intro={`黄金专属终端已就绪。我正在监控伦敦金、纽约金的跨市订单流以及美元指数的相关性。你可以问我 XAU/USD 的关键支撑/阻力、央行购金动向、ETF 净流入等任何问题，我会结合 Gemini 大模型给出多周期共振分析。`}
        placeholder="询问黄金行情或上传 XAU/USD K 线..."
      />
    </>
  );
}
