import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";
import { CryptoTickerStrip } from "@/components/crypto/CryptoTickerStrip";

export default function CryptoPage() {
  return (
    <>
      <PageHeader title="加密订单流雷达" badge="BINANCE FEED LIVE" />
      <CryptoTickerStrip />
      <ChatWindow
        channel="crypto"
        placeholder="询问 BTC/ETH 等加密资产..."
        suggestions={[
          "BTC 当前的链上资金流向是看涨还是看跌？",
          "ETH/BTC 比值跌破近期支撑代表什么？",
          "Solana 生态币近期有哪些资金异动？",
          "如何用 SMC 框架判断 BTC 这次回撤是不是骗炮？",
        ]}
      />
    </>
  );
}
