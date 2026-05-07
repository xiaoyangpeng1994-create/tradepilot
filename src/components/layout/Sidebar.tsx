"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ReactNode, useEffect, useState } from "react";

type NavItem = { href: string; label: string; icon: ReactNode; group: "channel" | "feature"; pro?: boolean };

const NAV: NavItem[] = [
  { href: "/gold", label: "黄金专属终端", icon: <IconChartUp />, group: "channel" },
  { href: "/forex", label: "外汇流动性窗口", icon: <IconRefresh />, group: "channel" },
  { href: "/crypto", label: "加密订单流雷达", icon: <IconBolt />, group: "channel" },
  { href: "/us-stocks", label: "美股主力追踪", icon: <IconBars />, group: "channel" },
  { href: "/a-shares", label: "A股主力透视", icon: <IconChartLine />, group: "channel" },
  { href: "/academy", label: "裸 K 实战学院", icon: <IconEye />, group: "feature" },
  { href: "/twitter", label: "X (推特) 大神追踪", icon: <IconTwitter />, group: "feature" },
  { href: "/agent", label: "代理商中心", icon: <IconUsers />, group: "feature" },
  { href: "/orders", label: "账单中心", icon: <IconReceipt />, group: "feature" },
  { href: "/profile", label: "个人中心", icon: <IconUser />, group: "feature" },
];

export function Sidebar({ pts = 2500, isVipActive = false }: { pts?: number; isVipActive?: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const channels = NAV.filter((n) => n.group === "channel");
  const features = NAV.filter((n) => n.group === "feature");

  // 切路由自动收抽屉
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 抽屉打开时禁止 body 滚动
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* 移动端汉堡按钮（仅 <md 显示） */}
      <button
        type="button"
        aria-label="打开菜单"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 size-9 rounded-md bg-bg-panel/90 border border-bg-edge backdrop-blur grid place-items-center text-ink-base hover:text-accent-razer hover:border-accent-razer/60 transition-colors"
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>

      {/* 移动端遮罩 */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-[280px] md:w-[260px] shrink-0
          border-r border-bg-edge bg-bg-panel/95 md:bg-bg-panel/40 backdrop-blur md:backdrop-blur-none
          flex flex-col
          transform transition-transform duration-200
          ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <div className="p-5 flex items-center gap-3 border-b border-bg-edge">
          <div className="size-10 rounded-lg bg-gradient-to-br from-accent-razer to-emerald-700 flex items-center justify-center text-bg-base font-bold razer-glow">P</div>
          <div className="flex-1">
            <div className="text-ink-bright text-sm font-bold tracking-wide">PENG GE AI</div>
            <div className="text-[9px] tracking-[0.25em] text-accent-razer uppercase">Trading Terminal</div>
          </div>
          {/* 移动端关闭按钮 */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="关闭菜单"
            className="md:hidden size-8 rounded-md grid place-items-center text-ink-muted hover:text-accent-danger"
          >
            <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 border-b border-bg-edge space-y-3">
          <div className="flex items-center justify-between">
            <span className="label-tag">Connectivity Status</span>
            <span className="size-2 rounded-full bg-accent-razer shadow-[0_0_8px_rgba(68,214,44,0.8)] animate-pulseLine" />
          </div>
          <div className="text-[11px] text-accent-razer tracking-wider">STANDARD_SSL_PROXY</div>
          <div>
            <div className="text-[10px] text-ink-dim uppercase tracking-widest">算力资源池</div>
            {isVipActive ? (
              <div className="text-2xl text-accent-gold font-light flex items-baseline gap-1.5">
                ∞ <span className="text-[10px] text-accent-gold tracking-widest uppercase">VIP 无限算力</span>
              </div>
            ) : (
              <div className="text-2xl text-ink-bright font-light">
                {pts.toLocaleString()} <span className="text-[10px] text-ink-dim">pts</span>
              </div>
            )}
          </div>
          <Link href="/pricing" className="btn-primary w-full">
            提升至专业版 (VIP)
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <NavGroup title="专属问询频道" items={channels} pathname={pathname} />
          <NavGroup title="功能面板 & 学习" items={features} pathname={pathname} />
        </nav>

        <div className="border-t border-bg-edge p-4 text-[11px] text-ink-muted">
          {session?.user ? (
            <div className="space-y-1">
              <Link
                href="/profile"
                className="text-ink-base truncate hover:text-accent-razer block transition-colors"
              >
                {session.user.name || session.user.email} →
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="text-accent-danger hover:text-red-400"
              >
                登出
              </button>
            </div>
          ) : (
            <Link href="/login" className="text-accent-razer">
              登录账号
            </Link>
          )}
        </div>
      </aside>
    </>
  );
}

function NavGroup({ title, items, pathname }: { title: string; items: NavItem[]; pathname: string }) {
  return (
    <div>
      <div className="label-tag mb-2 px-2">{title}</div>
      <div className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? "nav-item-active" : ""}`}
            >
              <span className="size-4 shrink-0">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function IconChartUp() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12L6 8l3 3 5-6" /><path d="M11 5h3v3" /></svg>;
}
function IconRefresh() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 8a6 6 0 11-1.76-4.24" /><path d="M14 2v4h-4" /></svg>;
}
function IconBolt() {
  return <svg viewBox="0 0 16 16" fill="currentColor"><path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" /></svg>;
}
function IconBars() {
  return <svg viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="9" width="2" height="5" /><rect x="6" y="5" width="2" height="9" /><rect x="10" y="2" width="2" height="12" /></svg>;
}
function IconChartLine() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14h12" /><path d="M3 11l3-4 3 2 4-6" /></svg>;
}
function IconEye() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" /><circle cx="8" cy="8" r="2" fill="currentColor" /></svg>;
}
function IconTwitter() {
  return <svg viewBox="0 0 16 16" fill="currentColor"><path d="M14 4.4q-.75.3-1.6.5.6-.3 1-1-.7.4-1.5.5C11 3.7 10 3.5 9 4q-1.5.7-1.5 2.4v.4Q4.5 6.5 2 4q-.5 1-.2 2t1.3 1.7q-.6 0-1-.3.1 1.3 2 2-.6.2-1.1 0 .5 1.3 2 1.5-.8.6-1.8.7-.6.1-1.2 0Q3.4 12.4 6 12.4q4 .1 6.4-3 1.5-2 1.4-4 .6-.4 1.2-1z" /></svg>;
}
function IconUsers() {
  return <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="6" cy="5" r="2.5" /><circle cx="12" cy="6" r="2" /><path d="M2 13c0-2 2-3.5 4-3.5s4 1.5 4 3.5v1H2zM10 14v-1c0-1.2-.5-2.2-1.4-2.9.5-.1.9-.1 1.4-.1 2 0 4 1.5 4 3.5v.5z" /></svg>;
}
function IconReceipt() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 1v14l2-1.5L7 15l2-1.5L11 15l2-1.5V1H3z" /><path d="M5 5h6M5 8h6M5 11h4" /></svg>;
}
function IconUser() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3" /><path d="M2 14c0-3 2.5-5 6-5s6 2 6 5" /></svg>;
}
