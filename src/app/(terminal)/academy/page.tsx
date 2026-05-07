import { ChatWindow } from "@/components/chat/ChatWindow";
import { PageHeader } from "@/components/layout/PageHeader";

type CourseLevel = "入门" | "进阶" | "高级";
type CourseFormat = "VIDEO" | "ARTICLE" | "CASE_STUDY";

type Course = {
  tags: [string, string];
  title: string;
  level: CourseLevel;
  duration: string;
  format: CourseFormat;
};

const COURSES: Course[] = [
  {
    tags: ["PRICE ACTION", "REVERSAL"],
    title: "裸K核心：PINBAR 见顶/见底信号",
    level: "入门",
    duration: "15 min",
    format: "VIDEO",
  },
  {
    tags: ["SMC", "INSTITUTIONAL"],
    title: "SMC 进阶：订单块 (ORDER BLOCK) 找寻逻辑",
    level: "进阶",
    duration: "25 min",
    format: "ARTICLE",
  },
  {
    tags: ["LIQUIDITY", "TRAP"],
    title: "流动性陷阱：如何识别主力扫损动机",
    level: "高级",
    duration: "40 min",
    format: "CASE_STUDY",
  },
  {
    tags: ["GAP", "TECHNICAL"],
    title: "FVG 缺口理论与回补概率计算",
    level: "进阶",
    duration: "20 min",
    format: "VIDEO",
  },
];

const LEVEL_STYLE: Record<CourseLevel, string> = {
  入门: "bg-accent-neon/15 border-accent-neon/40 text-accent-neon",
  进阶: "bg-accent-info/15 border-accent-info/40 text-accent-info",
  高级: "bg-accent-danger/15 border-accent-danger/40 text-accent-danger",
};

export default function AcademyPage() {
  return (
    <>
      <PageHeader
        title="裸 K 实战学院"
        badge="PENG GE TRADING ACADEMY · FROM ZERO TO HERO"
      />
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <AiTutorBanner />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COURSES.map((c) => (
            <CourseCard key={c.title} course={c} />
          ))}
        </div>

        <ConsultCta />
      </div>

      <div id="academy-chat" className="h-[40vh] min-h-[280px] border-t border-bg-edge">
        <ChatWindow
          channel="academy"
          intro="你好，我是彭哥 AI 助教。可以问我任意一节课的核心逻辑、追问难点，或者把你不懂的盘面截图发上来，我会按 SMC/ICT 框架一步步拆解。"
          placeholder="问问 AI 助教：这个课程的逻辑是什么？"
          suggestions={[
            "PINBAR 见顶/见底的关键确认条件是什么？",
            "怎么分辨「真」订单块和「假」订单块？",
            "FVG 缺口回补概率有没有量化标准？",
            "扫损后真破位 vs 假突破怎么区分？",
          ]}
        />
      </div>
    </>
  );
}

function AiTutorBanner() {
  return (
    <div className="terminal-card border-accent-gold/30 bg-gradient-to-r from-accent-gold/10 to-transparent p-5 flex items-center gap-4">
      <div className="size-12 shrink-0 rounded-md bg-accent-gold/20 border border-accent-gold/40 grid place-items-center">
        <svg viewBox="0 0 16 16" className="size-5 text-accent-gold" fill="currentColor">
          <path d="M9 1L3 9h4l-1 6 6-8H8l1-6z" />
        </svg>
      </div>
      <div className="flex-1">
        <div className="text-accent-gold text-sm font-bold tracking-wide">
          AI 助教已接入 (Google Gemini)
        </div>
        <div className="text-[11px] text-ink-muted leading-relaxed mt-1">
          在学习过程中有任何疑问？随时在下方对话框开启聊天！无论你想问什么，我都会基于实时行情和深度逻辑为你解答。点击左下方"相机"可上传盘面图。
        </div>
      </div>
    </div>
  );
}

function CourseCard({ course }: { course: Course }) {
  return (
    <div className="terminal-card p-5 relative overflow-hidden hover:border-accent-info/40 transition-colors group">
      <div className="absolute -right-6 -top-6 size-24 rounded-full bg-accent-info/5 group-hover:bg-accent-info/10 transition-colors" />

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex flex-wrap gap-2">
          {course.tags.map((t) => (
            <span
              key={t}
              className="text-[9px] tracking-widest uppercase text-ink-muted border border-bg-edge rounded-sm px-1.5 py-0.5"
            >
              {t}
            </span>
          ))}
        </div>
        <span
          className={`text-[10px] tracking-widest border rounded-sm px-1.5 py-0.5 shrink-0 ${LEVEL_STYLE[course.level]}`}
        >
          {course.level}
        </span>
      </div>

      <div className="text-ink-bright text-base font-bold tracking-wide leading-relaxed mb-6">
        {course.title}
      </div>

      <div className="flex items-center gap-4 text-[10px] text-ink-dim tracking-widest uppercase">
        <span className="flex items-center gap-1.5">
          <ClockIcon /> {course.duration}
        </span>
        <span className="flex items-center gap-1.5">
          <FormatIcon /> {course.format}
        </span>
      </div>
    </div>
  );
}

function ConsultCta() {
  return (
    <div className="rounded-lg p-6 flex items-center justify-between gap-4 bg-gradient-to-r from-accent-purple/15 via-accent-info/10 to-transparent border border-accent-purple/30">
      <div>
        <div className="text-ink-bright text-base font-bold tracking-wide">
          想结合实时盘面提问？
        </div>
        <div className="text-[11px] text-ink-muted mt-2 leading-relaxed max-w-xl">
          直接点击下方的"相机"按钮上传 K 线图，我会立即为你进行深度剖析。不要忘记，行情也是最好的教材。
        </div>
      </div>
      <a
        href="#academy-chat"
        className="btn-ghost shrink-0 text-xs hover:border-accent-purple/60 hover:text-ink-bright"
      >
        咨询实战营 →
      </a>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4v4l2.5 2.5" />
    </svg>
  );
}
function FormatIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="12" height="10" rx="1" />
      <path d="M2 6h12M6 13V6" />
    </svg>
  );
}
