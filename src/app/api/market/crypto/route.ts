import { fetchCryptoTickers } from "@/lib/market";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await fetchCryptoTickers();
  return Response.json(data);
}
