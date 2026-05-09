"use client";

/**
 * TradePilot Logo SVG 组件
 * 图标：K线图 + 上升箭头轨迹，象征 AI 辅助交易决策
 */
export function TradePilotIcon({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* 背景圆角矩形 */}
      <rect width="36" height="36" rx="9" fill="#10a37f" />

      {/* K线图：三根蜡烛 */}
      {/* 左蜡烛（下跌，红色） */}
      <rect x="7" y="16" width="4" height="8" rx="1" fill="rgba(255,255,255,0.5)" />
      <line x1="9" y1="13" x2="9" y2="16" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="9" y1="24" x2="9" y2="27" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />

      {/* 中蜡烛（上涨，白色实心） */}
      <rect x="14" y="12" width="4" height="10" rx="1" fill="white" />
      <line x1="16" y1="9" x2="16" y2="12" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16" y1="22" x2="16" y2="25" stroke="white" strokeWidth="1.2" strokeLinecap="round" />

      {/* 右蜡烛（上涨，白色实心，更高） */}
      <rect x="21" y="9" width="4" height="12" rx="1" fill="white" />
      <line x1="23" y1="6" x2="23" y2="9" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="23" y1="21" x2="23" y2="24" stroke="white" strokeWidth="1.2" strokeLinecap="round" />

      {/* 上升箭头（右上角） */}
      <path
        d="M27 10 L30 7 M30 7 L30 11 M30 7 L26 7"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TradePilotWordmark({
  size = 36,
  showIcon = true,
  className = "",
}: {
  size?: number;
  showIcon?: boolean;
  className?: string;
}) {
  const fontSize = Math.round(size * 0.44);
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {showIcon && <TradePilotIcon size={size} />}
      <span
        style={{
          fontSize,
          fontWeight: 600,
          color: "#f5f5f5",
          letterSpacing: "-0.01em",
          lineHeight: 1,
        }}
      >
        TradePilot
      </span>
    </div>
  );
}
