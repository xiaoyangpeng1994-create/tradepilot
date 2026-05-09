"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { TradePilotIcon } from "@/components/ui/TradePilotLogo";

// 核心功能导航 — 每项都有说明文字
const MAIN_NAV = [
  {
    href: "/history",
    label: "历史对话",
    desc: "查看过去的分析记录",
    icon: <IconHistory />,
  },
  {
    href: "/journal",
    label: "交易画像",
    desc: "AI 分析你的交易习惯",
    icon: <IconJournal />,
  },
  {
    href: "/pricing",
    label: "升级套餐",
    desc: "解锁高级模型和功能",
    icon: <IconBolt />,
  },
  {
    href: "/profile",
    label: "个人中心",
    desc: "邀请好友 · 账号设置",
    icon: <IconUser />,
  },
];

// 代理专属导航（agentLevel >= 1 才显示）
const AGENT_NAV = {
  href: "/agent",
  label: "代理后台",
  desc: "分润流水 · 节点管理",
  icon: <IconUsers />,
};

export function Sidebar({
  pts = 0,
  isVipActive = false,
  isVipPlusActive = false,
  agentLevel = 0,
}: {
  pts?: number;
  isVipActive?: boolean;
  isVipPlusActive?: boolean;
  agentLevel?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // 套餐标签
  const tierLabel = isVipPlusActive ? "TP-ULTRA" : isVipActive ? "TP-MAX" : "免费版";
  const tierColor = isVipPlusActive ? "#a855f7" : isVipActive ? "#f7931a" : "#10a37f";

  // 新对话：带时间戳跳转，确保每次 key 不同，ChatWindow 强制重新挂载
  function handleNewChat() {
    setOpen(false);
    router.push(`/?new=${Date.now()}`);
  }

  return (
    <>
      {/* 移动端汉堡按钮 */}
      <button
        type="button"
        aria-label="打开菜单"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 size-9 rounded-lg grid place-items-center"
        style={{ background: "#2a2a2a", border: "1px solid rgba(255,255,255,0.08)", color: "#a3a3a3" }}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>

      {/* 移动端遮罩 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-[260px] md:w-[240px] shrink-0
          flex flex-col
          transform transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={{ background: "#212121", borderRight: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* ── Logo 区 ── */}
        <div
          className="px-4 py-4 flex items-center gap-2.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
        >
          <TradePilotIcon size={30} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: "#f5f5f5" }}>TradePilot</div>
            <div className="text-[10px]" style={{ color: "#737373" }}>AI 交易副驾驶</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭菜单"
            className="md:hidden size-7 rounded-md grid place-items-center"
            style={{ color: "#737373" }}
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* ── 新对话 主入口按钮 ── */}
        <div className="px-3 pt-3 pb-2">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-all duration-150"
            style={{
              background: "rgba(16,163,127,0.12)",
              color: "#10a37f",
              border: "1px solid rgba(16,163,127,0.25)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,163,127,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(16,163,127,0.12)";
            }}
          >
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 3v10M3 8h10" />
            </svg>
            开始新对话
          </button>
        </div>

        {/* ── 主导航 ── */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {[...MAIN_NAV, ...(agentLevel >= 1 ? [AGENT_NAV] : [])].map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors duration-150"
                style={{
                  background: active ? "rgba(255,255,255,0.06)" : "transparent",
                  color: active ? "#f5f5f5" : "#a3a3a3",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                }}
              >
                <span
                  className="size-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: active ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.04)" }}
                >
                  <span className="size-4" style={{ color: active ? "#f5f5f5" : "#737373" }}>{item.icon}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium leading-tight">{item.label}</div>
                  <div className="text-[11px] leading-tight mt-0.5" style={{ color: "#525252" }}>{item.desc}</div>
                </div>
                {active && (
                  <div className="size-1.5 rounded-full shrink-0" style={{ background: "#10a37f" }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* ── 底部：套餐状态 + 用户 ── */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {/* 套餐状态条 */}
          <Link
            href="/pricing"
            className="flex items-center gap-2.5 px-4 py-3 transition-colors"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
          >
            <span className="size-2 rounded-full shrink-0" style={{ background: tierColor }} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium" style={{ color: "#d4d4d4" }}>{tierLabel}</div>
              {isVipActive ? (
                <div className="text-[10px]" style={{ color: "#525252" }}>
                  算力余额 {pts.toLocaleString()} pts
                </div>
              ) : (
                <div className="text-[10px]" style={{ color: "#525252" }}>
                  升级解锁高级模型 →
                </div>
              )}
            </div>
            <svg viewBox="0 0 16 16" className="size-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#525252" }}>
              <path d="M6 4l4 4-4 4" />
            </svg>
          </Link>

          {/* 用户信息 */}
          <div className="px-3 py-3">
            {session?.user ? (
              <div className="flex items-center gap-2">
                <div
                  className="size-7 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0"
                  style={{ background: "#303030" }}
                >
                  {(session.user.name || session.user.email || "U")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate" style={{ color: "#d4d4d4" }}>
                    {session.user.name || session.user.email}
                  </div>
                  <div className="text-[10px]" style={{ color: "#525252" }}>已登录</div>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  title="退出登录"
                  className="size-7 rounded-lg grid place-items-center transition-colors shrink-0"
                  style={{ color: "#525252" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#525252"; }}
                >
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M10 8H3M6 5l-3 3 3 3M11 4h2a1 1 0 011 1v6a1 1 0 01-1 1h-2" />
                  </svg>
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-2 text-sm transition-colors"
                style={{ color: "#737373" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#f5f5f5"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#737373"; }}
              >
                <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 8h7M10 5l3 3-3 3M5 4H3a1 1 0 00-1 1v6a1 1 0 001 1h2" />
                </svg>
                登录 / 注册
              </Link>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── 图标 ─────────────────────────────────────────────────────────────────────

function IconHistory() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l3 2" />
    </svg>
  );
}
function IconJournal() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 2h8a2 2 0 012 2v10H5a2 2 0 01-2-2V2z" />
      <path d="M3 12a2 2 0 012-2h8" />
      <path d="M6 5h5M6 8h4" />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M2 13c0-2 2-3.5 4-3.5s4 1.5 4 3.5" />
      <circle cx="12" cy="6" r="2" />
      <path d="M10.5 13c0-1.5 1-2.5 2.5-2.5" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="5" r="3" />
      <path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" />
    </svg>
  );
}
