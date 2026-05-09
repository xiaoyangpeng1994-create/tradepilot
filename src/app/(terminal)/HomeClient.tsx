"use client";
import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChatWindow,
  type ChatWindowHandle,
  type QuickTag,
} from "@/components/chat/ChatWindow";
import { Hero } from "@/components/home/Hero";
import type { SuggestionItem } from "@/lib/intel";

const QUICK_TAGS: QuickTag[] = [
  { label: "黄金", prefix: "黄金 " },
  { label: "BTC", prefix: "BTC " },
  { label: "外汇", prefix: "EUR/USD " },
  { label: "美股", prefix: "纳指 " },
];

function HomeBody({
  welcomeSlot,
  intelSlot,
  memberStatusSlot,
  suggestions,
}: {
  welcomeSlot: React.ReactNode;
  intelSlot: React.ReactNode;
  memberStatusSlot?: React.ReactNode;
  suggestions: SuggestionItem[];
}) {
  const ref = useRef<ChatWindowHandle>(null);
  const params = useSearchParams();
  const promptParam = params.get("prompt");
  const channelParam = params.get("channel") || "general";
  const sessionParam = params.get("session") || undefined;
  const newParam = params.get("new");
  const isNew = !!newParam;

  const chatKey = isNew
    ? `new-${newParam}`
    : `${channelParam}-${sessionParam ?? "default"}`;

  useEffect(() => {
    if (promptParam && ref.current) {
      ref.current.prefillInput(promptParam);
    }
  }, [promptParam]);

  return (
    <ChatWindow
      key={chatKey}
      ref={ref}
      channel={channelParam}
      sessionId={sessionParam}
      isNew={isNew}
      quickTags={QUICK_TAGS}
      suggestions={suggestions}
      placeholder="直接问：BTC 要不要平仓？黄金今天关键位置在哪？"
      emptyHeader={
        <div className="flex flex-col items-center gap-3 w-full">
          {/* Hero：Logo + 标题 + 能力卡片 + 示例问题 */}
          <Hero
            onStart={(q) => {
              if (q) {
                ref.current?.ask(q);
              } else {
                ref.current?.prefillInput("");
              }
            }}
            onUploadImage={() => ref.current?.openImagePicker()}
          />

          {/* 会员状态胶囊（登录后显示） */}
          {memberStatusSlot && (
            <div className="w-full max-w-[720px] px-0">
              {memberStatusSlot}
            </div>
          )}

          {/* AI 欢迎语（个性化，紧凑卡片） */}
          <div className="w-full max-w-[720px]">
            {welcomeSlot}
          </div>

          {/* 市场情报（可折叠） */}
          <div className="w-full max-w-[720px]">
            {intelSlot}
          </div>
        </div>
      }
    />
  );
}

export function HomeClient({
  welcomeSlot,
  intelSlot,
  memberStatusSlot,
  suggestions,
}: {
  welcomeSlot: React.ReactNode;
  intelSlot: React.ReactNode;
  memberStatusSlot?: React.ReactNode;
  suggestions: SuggestionItem[];
}) {
  return (
    <Suspense fallback={null}>
      <HomeBody
        welcomeSlot={welcomeSlot}
        intelSlot={intelSlot}
        memberStatusSlot={memberStatusSlot}
        suggestions={suggestions}
      />
    </Suspense>
  );
}
