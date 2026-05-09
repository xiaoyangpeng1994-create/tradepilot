import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"PingFang SC"', '"Helvetica Neue"', "Arial", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        bg: {
          base: "#171717",      // 主背景 - ChatGPT 深灰
          panel: "#212121",     // 侧边栏/面板
          card: "#2a2a2a",      // 卡片背景
          input: "#303030",     // 输入框
          edge: "#3a3a3a",      // 边框/分割线
        },
        accent: {
          green: "#10a37f",     // 主绿色点缀（ChatGPT 绿）
          gold: "#f7931a",      // VIP 金色
          danger: "#ef4444",    // 错误/危险
          info: "#10a37f",      // 信息色（同绿）
          // 保留旧别名，避免大量组件报错
          razer: "#10a37f",
          neon: "#10a37f",
          purple: "#10a37f",
        },
        ink: {
          dim: "#737373",       // 最弱文字
          muted: "#a3a3a3",     // 副文字
          base: "#d4d4d4",      // 正文
          bright: "#f5f5f5",    // 标题/强调
        },
      },
      boxShadow: {
        soft: "0 1px 3px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.04)",
        "soft-glow": "0 0 0 1px rgba(16,163,127,0.15), 0 0 16px -8px rgba(16,163,127,0.2)",
        card: "0 2px 8px rgba(0,0,0,0.4)",
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
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        marquee: "marquee 60s linear infinite",
        blink: "blink 1s step-end infinite",
        pulseLine: "pulseLine 2.4s ease-in-out infinite",
        fadeIn: "fadeIn 0.3s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
