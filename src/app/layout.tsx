import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://example.com"),
  title: {
    default: "PENG GE AI · TRADING TERMINAL",
    template: "%s · 彭哥 AI 交易终端",
  },
  description:
    "彭哥 AI 交易助手 — 基于 Gemini 1.5 Pro 的机构级交易终端，覆盖外汇、黄金、加密、美股、A 股 5 大市场，支持 SMC/ICT 智能盘面剖析。",
  keywords: [
    "彭哥 AI",
    "AI 交易",
    "Gemini 交易助手",
    "SMC 交易",
    "ICT 交易",
    "外汇分析",
    "加密订单流",
    "K 线分析",
  ],
  authors: [{ name: "Peng Ge AI" }],
  openGraph: {
    title: "PENG GE AI · TRADING TERMINAL",
    description: "Gemini 驱动的机构级 AI 交易终端，5 大市场 SMC/ICT 实时拆解。",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary_large_image",
    title: "PENG GE AI · TRADING TERMINAL",
    description: "Gemini 驱动的机构级 AI 交易终端。",
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
