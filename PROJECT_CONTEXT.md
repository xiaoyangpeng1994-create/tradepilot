# PROJECT_CONTEXT.md

## 产品定位

洞察AI · TradePilot 是 AI 交易副驾驶，不是喊单系统。核心是 Chat-first、交易画像、AI 陪练感、辅助用户理解市场与自身交易行为。

## 核心原则

* Chat-first：用户直接提问，AI 自动识别市场。
* AI 陪练感：像老交易员陪看盘，不像研报生成器。
* 不喊单、不自动交易、不做确定性收益承诺。
* 不做伪洞察；所有用户画像必须来自真实数据。
* FREE 短答观察型；VIP/ULTRA 结构化深度。
* 不暴露真实模型名；前端只显示 TP-CORE / TP-MAX / TP-ULTRA。
* 控制 token 成本，避免长上下文失控。
* 一轮只做一个小任务，不顺手优化。

## 技术栈

Next.js 14 App Router、Prisma、NextAuth、DashScope fallback、OpenRouter 灰度接入、TraderProfile、Guidance Layer、ChatSession / ChatMessage / Trade。

## 开发纪律

* 先输出 file-level plan，再按确认执行。
* 每次只改指定文件。
* 不大范围重构。
* 不顺手优化。
* 每轮结束输出：修改文件、tsc 结果、风险点、commit message。
* 大阶段完成后更新本文件，但保持 800 字以内。
