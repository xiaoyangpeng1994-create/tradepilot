"use client";
import { useEffect, useState } from "react";

/**
 * 顶部 AI 状态条：6s 一换。
 * 文案在 server 端从 IntelSnapshot 派生（buildPulseMessages），通过 props 传入。
 * 客户端只负责轮播 + 淡入淡出。
 */
export function AIPulseStrip({ messages }: { messages: string[] }) {
  const list = messages.length > 0 ? messages : ["TradePilot 在线陪你看市场"];
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (list.length <= 1) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % list.length);
        setVisible(true);
      }, 220);
    }, 6000);
    return () => clearInterval(interval);
  }, [list.length]);

  return (
    <span
      className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] tracking-wider text-ink-muted shrink-0 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      title="TradePilot 实时市场监测"
    >
      <span className="size-1 rounded-full bg-accent-razer animate-pulseLine" />
      <span className="truncate max-w-[260px]">{list[idx]}</span>
    </span>
  );
}
