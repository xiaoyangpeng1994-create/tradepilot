export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid-bg flex items-center justify-center px-4 py-10 relative">
      <div className="absolute top-0 left-0 right-0 border-b border-bg-edge bg-bg-panel/40 px-6 py-3 flex items-center gap-3">
        <div className="size-7 rounded-md bg-gradient-to-br from-accent-info to-accent-purple grid place-items-center text-white text-xs font-bold">
          P
        </div>
        <div>
          <div className="text-ink-bright text-xs font-bold tracking-wide">PENG GE AI</div>
          <div className="text-[8px] tracking-[0.25em] text-accent-info uppercase">
            Trading Terminal
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
