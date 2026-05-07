import type { Candle, Interval } from "./binance";
import { fetchKlines } from "./binance";

export type SwingPoint = {
  index: number;
  price: number;
  time: number;
  type: "high" | "low";
};

export type FVG = {
  type: "bullish" | "bearish";
  upper: number;
  lower: number;
  formedAt: number;
  formedTime: number;
  filled: boolean;
};

export type OrderBlock = {
  type: "bullish" | "bearish";
  upper: number;
  lower: number;
  formedAt: number;
  formedTime: number;
  tested: boolean;
  /** 突破后立刻冲到的极端价相对 OB 边界的百分比，越大说明这个 OB 触发的动能越强 */
  breakoutPct: number;
};

/**
 * Pivot 检测：第 i 根 K 线如果 high 严格大于左右各 lookback 根，记为 swing high；low 同理。
 * lookback=3 在 4H 周期上经验合适——既不会把每根 K 线都当结构，也不会漏掉关键拐点。
 */
export function detectSwings(candles: Candle[], lookback = 3): SwingPoint[] {
  const result: SwingPoint[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const c = candles[i];
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (candles[i - j].high >= c.high || candles[i + j].high >= c.high) isHigh = false;
      if (candles[i - j].low <= c.low || candles[i + j].low <= c.low) isLow = false;
    }
    if (isHigh) result.push({ index: i, price: c.high, time: c.openTime, type: "high" });
    if (isLow) result.push({ index: i, price: c.low, time: c.openTime, type: "low" });
  }
  return result;
}

/**
 * FVG 识别：连续三根 K 线 i-1, i, i+1
 * - 多头 FVG：candles[i+1].low > candles[i-1].high → 中间 K 线 i 留下未成交真空
 * - 空头 FVG：candles[i+1].high < candles[i-1].low
 * filled = 后续是否有 K 线穿回缺口（low 跌破 / high 涨破其原始边界）
 */
export function detectFVGs(candles: Candle[]): FVG[] {
  const result: FVG[] = [];
  for (let i = 1; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const next = candles[i + 1];

    if (next.low > prev.high) {
      let filled = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].low <= prev.high) {
          filled = true;
          break;
        }
      }
      result.push({
        type: "bullish",
        upper: next.low,
        lower: prev.high,
        formedAt: i,
        formedTime: candles[i].openTime,
        filled,
      });
    }

    if (next.high < prev.low) {
      let filled = false;
      for (let j = i + 2; j < candles.length; j++) {
        if (candles[j].high >= prev.low) {
          filled = true;
          break;
        }
      }
      result.push({
        type: "bearish",
        upper: prev.low,
        lower: next.high,
        formedAt: i,
        formedTime: candles[i].openTime,
        filled,
      });
    }
  }
  return result;
}

/**
 * 订单块（OB）识别（启发式简化版）：
 * - 多头 OB = 强势上涨突破前最后一根阴线；强势定义为 3 根内出现收盘价 ≥ 该阴线 high × 1.005
 * - 空头 OB = 强势下跌突破前最后一根阳线；同理
 * tested = 后续是否有 K 线回踩进 OB 区间
 * breakoutPct = 突破后窗口内冲到的极值相对 OB 边界的百分比（衡量动能）
 */
export function detectOrderBlocks(candles: Candle[]): OrderBlock[] {
  const result: OrderBlock[] = [];
  for (let i = 0; i < candles.length - 4; i++) {
    const c = candles[i];
    const isBearish = c.close < c.open;
    const isBullish = c.close > c.open;

    if (isBearish) {
      const target = c.high * 1.005;
      let breakIdx = -1;
      for (let j = i + 1; j <= Math.min(i + 3, candles.length - 1); j++) {
        if (candles[j].close > target) {
          breakIdx = j;
          break;
        }
      }
      if (breakIdx > 0) {
        // 取突破后 5 根内的最高价衡量动能
        let peak = candles[breakIdx].high;
        for (let j = breakIdx + 1; j <= Math.min(breakIdx + 5, candles.length - 1); j++) {
          if (candles[j].high > peak) peak = candles[j].high;
        }
        const breakoutPct = ((peak - c.high) / c.high) * 100;

        let tested = false;
        for (let j = breakIdx + 1; j < candles.length; j++) {
          if (candles[j].low <= c.high && candles[j].low >= c.low) {
            tested = true;
            break;
          }
        }
        result.push({
          type: "bullish",
          upper: c.high,
          lower: c.low,
          formedAt: i,
          formedTime: c.openTime,
          tested,
          breakoutPct,
        });
      }
    }

    if (isBullish) {
      const target = c.low * 0.995;
      let breakIdx = -1;
      for (let j = i + 1; j <= Math.min(i + 3, candles.length - 1); j++) {
        if (candles[j].close < target) {
          breakIdx = j;
          break;
        }
      }
      if (breakIdx > 0) {
        let trough = candles[breakIdx].low;
        for (let j = breakIdx + 1; j <= Math.min(breakIdx + 5, candles.length - 1); j++) {
          if (candles[j].low < trough) trough = candles[j].low;
        }
        const breakoutPct = ((c.low - trough) / c.low) * 100;

        let tested = false;
        for (let j = breakIdx + 1; j < candles.length; j++) {
          if (candles[j].high >= c.low && candles[j].high <= c.high) {
            tested = true;
            break;
          }
        }
        result.push({
          type: "bearish",
          upper: c.high,
          lower: c.low,
          formedAt: i,
          formedTime: c.openTime,
          tested,
          breakoutPct,
        });
      }
    }
  }
  return result;
}

/**
 * 在所有候选 OB 中按"动能 × 未测试加成 ÷ 距当前价百分比"打分，多/空各取 top N。
 * 这是给 LLM 用的浓缩——避免一次塞 6 个 OB 进 prompt 让模型挑花眼。
 *
 * 位置语义过滤：
 * - 多头 OB 仅在 mid ≤ 当前价（支撑作用）保留；若 mid 已在当前价上方，说明价格已跌穿，OB 失效
 * - 空头 OB 仅在 mid ≥ 当前价（阻力作用）保留；若 mid 已在当前价下方，说明价格已涨穿，OB 失效
 */
export function selectTopOrderBlocks(
  obs: OrderBlock[],
  currentPrice: number,
  perSide = 2,
): OrderBlock[] {
  const score = (ob: OrderBlock) => {
    const mid = (ob.upper + ob.lower) / 2;
    const distPct = Math.abs(currentPrice - mid) / currentPrice * 100;
    if (distPct < 0.05) return 0;
    const untestedBonus = ob.tested ? 1 : 1.5;
    return (ob.breakoutPct * untestedBonus) / Math.max(distPct, 0.5);
  };

  const stillValid = (ob: OrderBlock) => {
    const mid = (ob.upper + ob.lower) / 2;
    if (ob.type === "bullish") return mid <= currentPrice * 1.002;
    return mid >= currentPrice * 0.998;
  };

  const bullish = obs
    .filter((o) => o.type === "bullish" && stillValid(o))
    .sort((a, b) => score(b) - score(a))
    .slice(0, perSide);
  const bearish = obs
    .filter((o) => o.type === "bearish" && stillValid(o))
    .sort((a, b) => score(b) - score(a))
    .slice(0, perSide);

  return [...bullish, ...bearish].sort((a, b) => a.lower - b.lower);
}

/**
 * 流动性池：当前价格上方未被扫损的 swing high / 下方未被扫损的 swing low。
 * "未扫损" = 该 swing 形成后，后续没有 K 线突破其极值。
 */
export function detectLiquidityZones(
  candles: Candle[],
  swings: SwingPoint[],
): { aboveCurrent: SwingPoint[]; belowCurrent: SwingPoint[] } {
  if (candles.length === 0) return { aboveCurrent: [], belowCurrent: [] };
  const currentPrice = candles[candles.length - 1].close;

  const aboveCurrent: SwingPoint[] = [];
  const belowCurrent: SwingPoint[] = [];

  for (const s of swings) {
    let swept = false;
    for (let j = s.index + 1; j < candles.length; j++) {
      if (s.type === "high" && candles[j].high > s.price) {
        swept = true;
        break;
      }
      if (s.type === "low" && candles[j].low < s.price) {
        swept = true;
        break;
      }
    }
    if (swept) continue;
    if (s.type === "high" && s.price > currentPrice) aboveCurrent.push(s);
    if (s.type === "low" && s.price < currentPrice) belowCurrent.push(s);
  }

  return { aboveCurrent, belowCurrent };
}

function fmtPrice(p: number): string {
  if (p >= 1000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(5)}`;
}

function relTime(ms: number): string {
  const diff = Date.now() - ms;
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "刚刚";
  if (hours < 48) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

/**
 * 拉某个 symbol 指定周期 K 线 → 跑全套算法 → 输出可注入 prompt 的人读结构清单。
 * 失败时返回空字符串（不 throw，让 caller 选择降级）。
 *
 * 这是 Binance 数据源的便捷入口；非 Binance 标的（如黄金）走 buildStructureContextFromCandles。
 */
export async function buildStructureContext(
  symbol: string,
  interval: Interval = "4h",
): Promise<string> {
  const candles = await fetchKlines(symbol, interval, 200);
  return buildStructureContextFromCandles(candles, symbol, interval);
}

/**
 * 与 buildStructureContext 同样的输出格式，但接受外部已拉好的 candles。
 * 黄金 / 美股 / A 股等非 Binance 数据源走这个入口——数据源 lib 自己拉 K 线后传入即可复用同一套结构识别 + 文案。
 */
export function buildStructureContextFromCandles(
  candles: Candle[],
  symbol: string,
  interval: Interval,
): string {
  if (candles.length < 20) return "";

  const swings = detectSwings(candles, 3);
  const allFvgs = detectFVGs(candles);
  const allObs = detectOrderBlocks(candles);
  const liq = detectLiquidityZones(candles, swings);
  const last = candles[candles.length - 1];

  // 1H 视角更近，范围收紧到 ±5%；4H/1D 用 ±10%
  const rangePct = interval === "1h" || interval === "15m" || interval === "5m" ? 0.05 : 0.1;
  const lo = last.close * (1 - rangePct);
  const hi = last.close * (1 + rangePct);
  const inRange = (p: number) => p >= lo && p <= hi;

  const unfilled = allFvgs.filter(
    (f) => !f.filled && inRange((f.upper + f.lower) / 2),
  );
  const obsInRange = allObs.filter((o) => inRange((o.upper + o.lower) / 2));
  const topOBs = selectTopOrderBlocks(obsInRange, last.close, 2);

  const tfLabel = interval.toUpperCase();
  const lines: string[] = [];
  lines.push(`## ${symbol} ${tfLabel} 结构识别（后端算法基于最近 ${candles.length} 根 K 线计算）`);
  lines.push(`最新收盘: ${fmtPrice(last.close)}（${relTime(last.openTime)}该 K 线开始）`);

  if (unfilled.length > 0) {
    lines.push(``, `### ${tfLabel} 未填补 FVG（共 ${unfilled.length} 个）`);
    for (const f of unfilled.slice(-5)) {
      lines.push(
        `- ${f.type === "bullish" ? "多头" : "空头"} FVG: ${fmtPrice(f.lower)} – ${fmtPrice(f.upper)}（${relTime(f.formedTime)}形成）`,
      );
    }
  } else {
    lines.push(``, `### ${tfLabel} 未填补 FVG`, `- 当前价格 ±${rangePct * 100}% 范围内无未填补 FVG`);
  }

  if (topOBs.length > 0) {
    lines.push(``, `### ${tfLabel} 关键订单块（多/空各前 2，按动能 × 未测试加成 ÷ 距离打分）`);
    for (const ob of topOBs) {
      lines.push(
        `- ${ob.type === "bullish" ? "多头" : "空头"} OB: ${fmtPrice(ob.lower)} – ${fmtPrice(ob.upper)}（突破动能 ${ob.breakoutPct.toFixed(1)}%${ob.tested ? "，已测试" : "，未测试"}）`,
      );
    }
  }

  const above = liq.aboveCurrent.sort((a, b) => a.price - b.price).slice(0, 3);
  const below = liq.belowCurrent.sort((a, b) => b.price - a.price).slice(0, 3);
  if (above.length > 0 || below.length > 0) {
    lines.push(``, `### ${tfLabel} 待扫损流动性（未被穿越的 swing 极值）`);
    if (above.length > 0) {
      lines.push(`- 上方: ${above.map((s) => fmtPrice(s.price)).join(" / ")}`);
    }
    if (below.length > 0) {
      lines.push(`- 下方: ${below.map((s) => fmtPrice(s.price)).join(" / ")}`);
    }
  }

  return lines.join("\n");
}
