type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<any>>();

import { detectMarketFromMessage } from "./detect-market";

export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

export type CryptoTicker = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  volume: number;
  high: number;
  low: number;
};

const CRYPTO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "DOGEUSDT"];

export async function fetchCryptoTickers(): Promise<CryptoTicker[]> {
  return cached("crypto:24hr", 5_000, async () => {
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(CRYPTO_SYMBOLS))}`,
        { next: { revalidate: 5 } },
      );
      if (!res.ok) throw new Error(`binance ${res.status}`);
      const list = (await res.json()) as Array<{
        symbol: string;
        lastPrice: string;
        priceChangePercent: string;
        volume: string;
        highPrice: string;
        lowPrice: string;
      }>;
      return list.map((t) => ({
        symbol: t.symbol,
        lastPrice: Number(t.lastPrice),
        priceChangePercent: Number(t.priceChangePercent),
        volume: Number(t.volume),
        high: Number(t.highPrice),
        low: Number(t.lowPrice),
      }));
    } catch {
      // 网络受限时回落 mock
      return CRYPTO_SYMBOLS.map((s, i) => ({
        symbol: s,
        lastPrice: [64500, 3120, 158, 612, 0.51, 0.13][i],
        priceChangePercent: [+2.4, -1.1, +5.2, +0.4, -0.6, +3.1][i],
        volume: [12340, 89231, 41234, 22341, 99123, 312341][i],
        high: [65800, 3180, 162, 620, 0.53, 0.14][i],
        low: [62100, 3050, 149, 605, 0.49, 0.12][i],
      }));
    }
  });
}

export type ForexQuote = {
  pair: string;
  price: number;
};

const FOREX_PAIRS = [
  ["EUR", "USD"],
  ["GBP", "USD"],
  ["USD", "JPY"],
  ["AUD", "USD"],
  ["USD", "CHF"],
  ["EUR", "AUD"],
] as const;

export async function fetchForexQuotes(): Promise<ForexQuote[]> {
  return cached("forex:latest", 60_000, async () => {
    try {
      const res = await fetch("https://api.exchangerate.host/latest?base=USD", {
        next: { revalidate: 60 },
      });
      if (!res.ok) throw new Error(`exchangerate ${res.status}`);
      const data = (await res.json()) as { rates: Record<string, number> };
      return FOREX_PAIRS.map(([base, quote]) => {
        const baseRate = base === "USD" ? 1 : data.rates[base];
        const quoteRate = quote === "USD" ? 1 : data.rates[quote];
        const price = quote === "USD" ? 1 / baseRate : quoteRate / baseRate;
        return { pair: `${base}/${quote}`, price };
      });
    } catch {
      return [
        { pair: "EUR/USD", price: 1.0832 },
        { pair: "GBP/USD", price: 1.2649 },
        { pair: "USD/JPY", price: 154.23 },
        { pair: "AUD/USD", price: 0.6612 },
        { pair: "USD/CHF", price: 0.9051 },
        { pair: "EUR/AUD", price: 1.6234 },
      ];
    }
  });
}

/**
 * 给 LLM 注入"我是现在、不是训练数据"的实时上下文。
 * 返回的字符串会拼接到 system prompt 末尾。
 *
 * tradingStyle 决定 K 线周期组合：
 * - INTRADAY → 15m + 1H
 * - SWING / LEARNING → 1H + 4H
 * - POSITION → 4H + 1D
 */
export async function buildMarketContext(
  channel: string,
  userMessage?: string,
  tradingStyle?: string,
): Promise<string> {
  const now = new Date().toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });

  // 主入口（"general"）：尝试根据用户消息识别真实市场，注入对应实时数据
  // ChatSession.channel 仍存 "general"——此处只为 system prompt 选数据源
  let effective = channel;
  let autoDetected = false;
  if (channel === "general" && userMessage) {
    const guess = detectMarketFromMessage(userMessage);
    if (guess) {
      effective = guess;
      autoDetected = true;
    }
  }

  const lines: string[] = [
    `# 实时上下文（请优先采用，不要使用训练数据中的过时价格）`,
    `当前北京时间: ${now}`,
  ];
  if (autoDetected) {
    lines.push(
      `> 已根据消息自动识别为「${effective}」市场，下方注入了相应实时数据。请在回答时**自然引用具体价格 / 结构数字**，让用户感觉你在看盘。`,
    );
  }

  if (effective === "crypto") {
    try {
      const tickers = await fetchCryptoTickers();
      lines.push(``, `## 加密资产 24h 现货行情 (Binance)`);
      for (const t of tickers) {
        const sign = t.priceChangePercent >= 0 ? "+" : "";
        lines.push(
          `- ${t.symbol}: $${t.lastPrice.toLocaleString()} (${sign}${t.priceChangePercent.toFixed(2)}%, 24H 高 ${t.high} / 低 ${t.low})`,
        );
      }
    } catch {}

    // 注入按交易风格选取的多周期 K 线结构识别
    try {
      const { detectCryptoSymbol, STYLE_INTERVALS } = await import("./binance");
      const { buildStructureContext } = await import("./structure");
      const symbol = detectCryptoSymbol(userMessage ?? "");
      const [tfShort, tfLong] = STYLE_INTERVALS[tradingStyle ?? "SWING"] ?? STYLE_INTERVALS.SWING;
      const [structShort, structLong] = await Promise.all([
        buildStructureContext(symbol, tfShort),
        buildStructureContext(symbol, tfLong),
      ]);
      if (structShort) lines.push(``, structShort);
      if (structLong) lines.push(``, structLong);
      if (structShort || structLong) {
        lines.push(
          ``,
          `> 以上 ${tfShort.toUpperCase()} / ${tfLong.toUpperCase()} 结构均由后端算法基于真实 K 线计算（按用户交易风格选取）。**回答时必须使用这些价位**，不得自行虚构 OB / FVG / 流动性数字。`,
        );
      }
    } catch {}
  } else if (effective === "forex") {
    try {
      const quotes = await fetchForexQuotes();
      lines.push(``, `## 主要外汇即时报价`);
      for (const q of quotes) {
        // change 字段当前是占位随机数，先不注入百分比，避免 AI 引用编出的数据
        lines.push(`- ${q.pair}: ${q.price.toFixed(4)}`);
      }
    } catch {}
  } else if (effective === "gold") {
    try {
      const { fetchGoldQuote, fetchGoldKlines, GOLD_SOURCE_LABELS } = await import("./gold");
      const { STYLE_INTERVALS } = await import("./binance");
      const { buildStructureContextFromCandles } = await import("./structure");

      const q = await fetchGoldQuote();
      if (!q) {
        // 双源都挂 — 严禁喂假数据，直接告诉模型本次没有实时行情
        lines.push(
          ``,
          `## 黄金现货 XAU/USD`,
          `> ⚠️ 实时行情接入失败（Yahoo + Binance PAXG 两路均不可用）。本次回答仅做框架性分析；**绝不能引用任何具体价位数字**——不知道现价就坦率说不知道。`,
        );
      } else {
        const sign = q.changePct >= 0 ? "+" : "";
        const ageS = Math.max(0, Math.round((Date.now() - q.fetchedAt) / 1000));
        const ageLabel = ageS < 60 ? `${ageS}s 前` : `${Math.round(ageS / 60)}min 前`;
        lines.push(
          ``,
          `## 黄金现货 XAU/USD（USD/oz · 来源: ${GOLD_SOURCE_LABELS[q.source]} · 数据 ${ageLabel}）`,
          `- 现价: $${q.price.toFixed(2)}（${sign}${q.changePct.toFixed(2)}%, ${sign}${q.change.toFixed(2)}）`,
          `- 24H 区间: $${q.low24h.toFixed(2)} – $${q.high24h.toFixed(2)}`,
        );

        const [tfShort, tfLong] = STYLE_INTERVALS[tradingStyle ?? "SWING"] ?? STYLE_INTERVALS.SWING;
        const [candlesShort, candlesLong] = await Promise.all([
          fetchGoldKlines(tfShort, 200),
          fetchGoldKlines(tfLong, 200),
        ]);
        const structShort =
          candlesShort.length >= 20
            ? buildStructureContextFromCandles(candlesShort, "XAUUSD", tfShort)
            : "";
        const structLong =
          candlesLong.length >= 20
            ? buildStructureContextFromCandles(candlesLong, "XAUUSD", tfLong)
            : "";
        if (structShort) lines.push(``, structShort);
        if (structLong) lines.push(``, structLong);
        if (structShort || structLong) {
          lines.push(
            ``,
            `> 以上 ${tfShort.toUpperCase()} / ${tfLong.toUpperCase()} 黄金结构均由后端算法基于真实 K 线计算（按用户交易风格选取；4H 由 1H ×4 按 UTC 0/4/8/12/16/20 边界聚合）。**回答时必须使用这些价位**，不得自行虚构 OB / FVG / 流动性数字。`,
          );
        } else {
          lines.push(
            ``,
            `> ⚠️ K 线数据接入不足，结构识别本次不可用；不要给出具体的 OB / FVG 价位。`,
          );
        }
      }
    } catch {}
  }

  lines.push(
    ``,
    `若用户询问以上未列出的标的（美股/A股/期权等），请坦率说明"暂无实时数据接入，以下为基于经验的框架分析"再给结论。`,
  );

  // 用户问的是具体市场但本次没注入实时数据 → 让 AI 顺势邀请上传截图
  // 触发条件：自动识别命中 OR channel 是没有数据源的市场（us-stocks / a-shares）
  // 不触发：channel="general" 且无关键词命中（用户在问通识/教学）；academy / twitter 等非市场频道
  const dataInjectedMarkets = ["crypto", "gold", "forex"];
  const knownMarkets = [...dataInjectedMarkets, "us-stocks", "a-shares"];
  const hasInjectedData = dataInjectedMarkets.includes(effective);
  const isAssetQuery = knownMarkets.includes(effective);
  if (isAssetQuery && !hasInjectedData) {
    const ASSET_LABEL: Record<string, string> = {
      "us-stocks": "美股",
      "a-shares": "A 股",
    };
    const label = ASSET_LABEL[effective] ?? "该标的";
    lines.push(
      ``,
      `> ⚠ 本次未注入「${label}」实时数据（暂无对应数据源接入）。回答时请：`,
      `> 1. 坦率说明"暂无实时数据接入"，**绝不编造具体价格 / 结构数字**`,
      `> 2. **顺势自然邀请上传截图**：在回答末段加一句"如果方便，截一张当前${label} K 线图发上来，我就能基于真实形态给具体的潜在关注区域 / 结构失效参考"——语气轻、不强求`,
      `> 3. 仍可基于经验给框架性观察（结构概念 / 宏观背景），但不要出现具体价位数字`,
    );
  }
  return lines.join("\n");
}
