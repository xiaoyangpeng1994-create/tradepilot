import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        display: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        bg: {
          base: "#05070a",
          panel: "#0b0f15",
          card: "#0f141c",
          edge: "#1a212c",
        },
        accent: {
          gold: "#f7931a",     // VIP 专用，唯一保留的"非绿"装饰色
          neon: "#44D62C",     // 统一为雷蛇绿（原 #39d98a 薄荷绿）
          danger: "#ef4444",
          info: "#44D62C",     // razer green —— 主色 (原 #3b82f6 蓝)
          razer: "#44D62C",    // 显式别名
          purple: "#44D62C",   // 统一为雷蛇绿（原 #a855f7 紫）
        },
        ink: {
          dim: "#5b6470",
          muted: "#8b95a3",
          base: "#c8d0db",
          bright: "#e5ecf5",
        },
      },
      keyframes: {
        marquee: {
          from: { transform: "translateX(0%)" },
          to: { transform: "translateX(-50%)" },
        },
        blink: {
          "0%,49%": { opacity: "1" },
          "50%,100%": { opacity: "0" },
        },
        pulseLine: {
          "0%": { opacity: "0.4" },
          "50%": { opacity: "1" },
          "100%": { opacity: "0.4" },
        },
      },
      animation: {
        marquee: "marquee 60s linear infinite",
        blink: "blink 1s step-end infinite",
        pulseLine: "pulseLine 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
