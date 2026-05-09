"use client";
import { TradePilotIcon } from "@/components/ui/TradePilotLogo";

// 四大核心能力卡片 — 可点击，直接触发对话
const CAPABILITY_CARDS = [
  {
    icon: "📈",
    title: "行情分析",
    desc: "关键支撑/压力位",
    example: "黄金今天的关键位置在哪？现在适合做多还是做空？",
    tag: "行情",
    tagColor: "#10a37f",
  },
  {
    icon: "📷",
    title: "K线读图",
    desc: "上传截图 AI 解读",
    example: "（上传K线图）",
    tag: "图表",
    tagColor: "#6366f1",
    isImage: true,
  },
  {
    icon: "⚠️",
    title: "持仓风险",
    desc: "止损/仓位合理性",
    example: "我持有 BTC 多单，入场 95000，现在 93000，该怎么办？",
    tag: "风控",
    tagColor: "#f59e0b",
  },
  {
    icon: "🧠",
    title: "交易复盘",
    desc: "找出你的交易弱点",
    example: "帮我分析最近的交易记录，我哪里做得不好？",
    tag: "复盘",
    tagColor: "#ec4899",
  },
];

// 快速示例问题 — 一眼看出能问什么
const QUICK_EXAMPLES = [
  "纳指今晚走势怎么看？",
  "BTC 现在能追多吗？",
  "欧元/美元今日关键位",
  "黄金短线方向判断",
];

// 支持市场
const MARKETS = ["外汇", "黄金", "加密货币", "美股", "A股"];

export function Hero({
  onStart,
  onUploadImage,
}: {
  onStart: (q?: string) => void;
  onUploadImage: () => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 pt-8 pb-4 select-none w-full max-w-[720px] mx-auto">
      {/* ── Logo + 品牌名 ── */}
      <div className="flex flex-col items-center gap-2 mb-5">
        <TradePilotIcon size={44} />
        <div className="flex flex-col items-center gap-0.5">
          <span
            className="text-[10px] font-semibold tracking-[0.18em] uppercase"
            style={{ color: "#10a37f" }}
          >
            AI Trading Copilot
          </span>
        </div>
      </div>

      {/* ── 主标题 ── */}
      <h1
        className="text-2xl sm:text-3xl font-bold mb-2 leading-tight text-center"
        style={{ color: "#f5f5f5" }}
      >
        你的 AI 交易副驾驶
      </h1>

      {/* ── 副标题：一句话说清楚能做什么 ── */}
      <p
        className="text-sm sm:text-[15px] leading-relaxed text-center mb-5 max-w-[480px]"
        style={{ color: "#a3a3a3" }}
      >
        分析行情、读懂K线、评估持仓风险、复盘交易习惯
        <br />
        <span style={{ color: "#737373" }}>
          支持{MARKETS.join(" · ")}
        </span>
      </p>

      {/* ── 四大能力卡片 ── */}
      <div className="grid grid-cols-2 gap-2.5 w-full mb-4">
        {CAPABILITY_CARDS.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => {
              if (card.isImage) {
                onUploadImage();
              } else {
                onStart(card.example);
              }
            }}
            className="group flex flex-col items-start gap-1.5 rounded-xl p-3.5 text-left transition-all duration-150"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.07)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(255,255,255,0.12)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background =
                "rgba(255,255,255,0.04)";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(255,255,255,0.07)";
            }}
          >
            {/* 图标 + tag */}
            <div className="flex items-center justify-between w-full">
              <span className="text-xl leading-none">{card.icon}</span>
              <span
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                style={{
                  background: `${card.tagColor}18`,
                  color: card.tagColor,
                  border: `1px solid ${card.tagColor}30`,
                }}
              >
                {card.tag}
              </span>
            </div>
            {/* 标题 + 描述 */}
            <div>
              <div
                className="text-sm font-semibold leading-tight mb-0.5"
                style={{ color: "#e5e5e5" }}
              >
                {card.title}
              </div>
              <div className="text-[12px] leading-snug" style={{ color: "#737373" }}>
                {card.desc}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── 快速示例问题 ── */}
      <div className="flex flex-wrap justify-center gap-2 w-full">
        {QUICK_EXAMPLES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onStart(q)}
            className="text-xs px-3 py-1.5 rounded-full transition-all duration-150"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#a3a3a3",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#e5e5e5";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(255,255,255,0.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#a3a3a3";
              (e.currentTarget as HTMLButtonElement).style.borderColor =
                "rgba(255,255,255,0.08)";
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* ── K线上传提示 ── */}
      <p className="text-[11px] mt-3" style={{ color: "#525252" }}>
        💡 点击输入框左侧相机图标可上传 K 线截图，AI 按 SMC/ICT 框架深度分析
      </p>
    </div>
  );
}
