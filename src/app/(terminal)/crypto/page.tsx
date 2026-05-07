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
        intro={`加密订单流雷达已锁定 Binance 现货 24h ticker。我会持续追踪 BTC/ETH/SOL 等主要资产的资金流向、CVD（买卖压力差）、ETF 净流入。提问时尽可能附上具体币种或上传订单簿热力图截图，我会基于 Gemini 给出 SMC + ICT 视角的拆解。`}
        placeholder="询问 BTC/ETH 等加密资产..."
      />
    </>
  );
}
