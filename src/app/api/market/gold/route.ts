import { fetchGoldQuote } from "@/lib/gold";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 返回与 /api/market/crypto 同形状的 Ticker[]，方便 TopTicker 直接合并展示。
// 接入失败返空数组——不返 mock 假数据，TopTicker 自动落到 stale 状态。
export async function GET() {
  const q = await fetchGoldQuote();
  if (!q) return Response.json([]);
  return Response.json([
    {
      symbol: "XAUUSD",
      lastPrice: q.price,
      priceChangePercent: q.changePct,
    },
  ]);
}
