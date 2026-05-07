import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || "";
export const geminiAvailable = apiKey.length > 0;

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export function getProModel() {
  if (!genAI) return null;
  return genAI.getGenerativeModel({
    model: "gemini-1.5-pro-latest",
    systemInstruction:
      "你是\"彭哥 AI\"，一个专业的金融交易分析助手。你擅长 SMC（Smart Money Concept）、ICT、订单块、流动性扫损、FVG（Fair Value Gap）、裸 K 行为分析。回答需简洁、结构化，使用专业术语，并在涉及交易建议时附上明确的入场/止损/止盈建议。所有回答用中文。",
  });
}

export function mockReply(prompt: string): string {
  const trimmed = prompt.slice(0, 60);
  return [
    `[MOCK_MODE — 未配置 GEMINI_API_KEY]`,
    ``,
    `已收到指令: "${trimmed}${prompt.length > 60 ? "..." : ""}"`,
    ``,
    `📊 模型分析:`,
    `当前主要货币对处于流动性失衡区间（FVG 0.5-0.618）。建议关注以下几点:`,
    `• 入场: 等待 H1 级别 MSB 确认`,
    `• 止损: 影线高/低点上方 5 pips`,
    `• 止盈: 1:3 RR，目标本周高点`,
    ``,
    `(配置 GEMINI_API_KEY 后将使用真实 Gemini 1.5 Pro 推理)`,
  ].join("\n");
}
