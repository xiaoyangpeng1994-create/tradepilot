"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageData?: string;
  ts: string;
};

export type ChatWindowHandle = {
  ask: (text: string) => void;
};

export const ChatWindow = forwardRef<ChatWindowHandle, {
  channel: string;
  intro: string;
  placeholder?: string;
}>(function ChatWindow(
  {
    channel,
    intro,
    placeholder = "输入行情代码或与彭哥对话...",
  },
  ref,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "intro",
      role: "assistant",
      content: intro,
      ts: nowTs(),
    },
  ]);
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(text: string, imageBase64?: string) {
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      imageData: imageBase64,
      ts: nowTs(),
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      ts: nowTs(),
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setPending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, message: text, image: imageBase64 || null }),
      });

      if (!res.body) throw new Error("no body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)),
        );
      }
    } catch (e) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, content: "[网络错误，请稍后重试]" } : m,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  useImperativeHandle(ref, () => ({
    ask: (text: string) => {
      if (pending) return;
      send(text);
    },
  }), [pending]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {pending && <TypingDots />}
      </div>
      <ChatInput onSend={send} disabled={pending} placeholder={placeholder} />
    </div>
  );
});

function ChatBubble({ message }: { message: ChatMessage }) {
  if (message.role === "assistant") {
    return (
      <div>
        <div className="text-[10px] tracking-widest text-ink-dim mb-1.5">
          PENG_GE_AI_ENGINE <span className="ml-2 text-accent-neon">{message.ts}</span>
        </div>
        <div className="terminal-card border-bg-edge p-4 max-w-[680px] text-sm text-ink-base whitespace-pre-wrap leading-relaxed">
          {message.content || <span className="text-ink-dim animate-blink">▍</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[560px]">
        <div className="text-[10px] tracking-widest text-ink-dim mb-1.5 text-right">
          USER <span className="ml-2">{message.ts}</span>
        </div>
        <div className="bg-accent-info/10 border border-accent-info/30 rounded-md p-3 text-sm text-ink-bright">
          {message.imageData && (
            <img
              src={message.imageData}
              alt="K 线截图"
              className="rounded mb-2 max-h-48 object-contain"
            />
          )}
          {message.content}
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 text-ink-dim text-xs">
      <span className="size-1.5 bg-accent-info rounded-full animate-pulseLine" />
      <span className="size-1.5 bg-accent-info rounded-full animate-pulseLine [animation-delay:0.2s]" />
      <span className="size-1.5 bg-accent-info rounded-full animate-pulseLine [animation-delay:0.4s]" />
      <span className="ml-2">推理中...</span>
    </div>
  );
}

function ChatInput({
  onSend,
  disabled,
  placeholder,
}: {
  onSend: (text: string, image?: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;
    onSend(text.trim() || "请分析这张 K 线图。", imagePreview || undefined);
    setText("");
    setImagePreview(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-bg-edge p-4 bg-bg-panel/30">
      {imagePreview && (
        <div className="mb-3 flex items-center gap-3">
          <img src={imagePreview} alt="" className="h-16 rounded border border-bg-edge" />
          <button
            type="button"
            onClick={() => setImagePreview(null)}
            className="text-xs text-accent-danger"
          >
            移除
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 terminal-card px-3 py-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="size-8 rounded grid place-items-center text-ink-muted hover:text-accent-info"
          title="上传 K 线截图"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="4" width="12" height="9" rx="1" />
            <circle cx="8" cy="8.5" r="2" />
            <path d="M5 4l1-1.5h4L11 4" />
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent outline-none text-sm text-ink-bright placeholder:text-ink-dim"
        />
        <button
          type="submit"
          disabled={disabled}
          className="size-8 grid place-items-center rounded bg-accent-info/15 border border-accent-info/40 text-accent-info hover:bg-accent-info/25 disabled:opacity-40"
        >
          <svg viewBox="0 0 16 16" className="size-3.5" fill="currentColor">
            <path d="M2 8l12-6-3 14-3-6-6-2z" />
          </svg>
        </button>
      </div>
    </form>
  );
}

function nowTs() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}
