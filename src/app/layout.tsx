import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://example.com"),
  title: {
    default: "洞察AI · TradePilot",
    template: "%s · 洞察AI · TradePilot",
  },
  description:
    "洞察AI · TradePilot — AI 交易副驾驶。覆盖外汇、黄金、加密、美股、A 股，问任何市场、上传 K 线、分析持仓，让 AI 帮你理解市场。",
  keywords: [
    "洞察AI",
    "TradePilot",
    "AI 交易副驾驶",
    "AI 交易",
    "SMC 交易",
    "ICT 交易",
    "外汇分析",
    "加密订单流",
    "K 线分析",
  ],
  authors: [{ name: "TradePilot" }],
  openGraph: {
    title: "洞察AI · TradePilot",
    description:
      "洞察AI · TradePilot — AI 交易副驾驶。覆盖外汇、黄金、加密、美股、A 股，问任何市场、上传 K 线、分析持仓，让 AI 帮你理解市场。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "洞察AI · TradePilot",
    description: "AI 交易副驾驶 — 让 AI 帮你理解市场，而不是替你冲动交易。",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#05070a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-bg-base text-ink-base font-mono">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
