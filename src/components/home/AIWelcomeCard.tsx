import { auth } from "@/lib/auth";
import {
  buildWelcomeMessage,
  getTodayRisks,
  getTraderInsight,
} from "@/lib/intel";

/**
 * RSC：根据时间 + 用户交易档案 + 今日风险事件生成欢迎语。
 * 紧凑版：一行时间 + 一段个性化提示，嵌入 Hero 下方。
 */
export async function AIWelcomeCard() {
  const now = new Date();
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const nickname = session?.user?.name ?? null;

  const insight = userId ? await getTraderInsight(userId) : null;
  const risks = getTodayRisks(now);

  const message = buildWelcomeMessage({
    now,
    nickname,
    insight,
    risks,
  });

  const timeStr = now.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="max-w-[720px] w-full rounded-xl px-4 py-3 flex items-start gap-3"
      style={{
        background: "rgba(16,163,127,0.06)",
        border: "1px solid rgba(16,163,127,0.12)",
      }}
    >
      {/* 绿点 */}
      <span
        className="mt-1 size-1.5 rounded-full shrink-0 animate-pulseLine"
        style={{ background: "#10a37f" }}
      />
      <div className="flex-1 min-w-0">
        {/* 时间戳 */}
        <span
          className="text-[11px] font-mono mr-2"
          style={{ color: "#10a37f", opacity: 0.7 }}
        >
          {timeStr}
        </span>
        {/* 欢迎语 */}
        <span className="text-[13px] leading-relaxed" style={{ color: "#a3a3a3" }}>
          {message}
        </span>
      </div>
    </div>
  );
}
