"use client";
import { useState } from "react";

/**
 * 桌面端默认展开，移动端默认折叠。
 * 让桌面用户一眼看到市场情报，移动端保持输入框优先。
 */
export function CollapsibleOnMobile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  // 桌面端默认展开（SSR 安全：先 false，客户端 hydrate 后根据宽度决定）
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-[720px] w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-medium transition-colors duration-150 mb-1"
        style={{ color: open ? "#a3a3a3" : "#525252" }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = "#a3a3a3";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = open
            ? "#a3a3a3"
            : "#525252";
        }}
      >
        {/* 左侧装饰线 */}
        <span
          className="h-px w-4 shrink-0 transition-colors duration-150"
          style={{ background: open ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)" }}
        />
        <span className="tracking-wide uppercase">{label}</span>
        <svg
          viewBox="0 0 16 16"
          className={`size-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
        {/* 右侧装饰线 */}
        <span
          className="h-px flex-1 transition-colors duration-150"
          style={{ background: open ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.06)" }}
        />
      </button>
      {open && (
        <div className="mt-2 animate-fadeIn">{children}</div>
      )}
    </div>
  );
}
