import "@/styles/globals.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "PENG GE AI · TRADING TERMINAL",
  description: "彭哥 AI 交易助手 — Institutional-grade trading terminal powered by Gemini.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="min-h-screen bg-bg-base text-ink-base font-mono">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
