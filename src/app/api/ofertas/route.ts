import { getBestOffers } from "@/lib/offers";
import type { OffersResponse } from "@/lib/types";

export const maxDuration = 60;
export const preferredRegion = "gru1";

export async function GET() {
  const offers = await getBestOffers();
  const body: OffersResponse = { fetchedAt: new Date().toISOString(), offers };

  return Response.json(body, {
    headers: {
      // Recomputed at most every 6 h; visitors get the cached copy instantly meanwhile.
      "Cache-Control": offers.length
        ? "public, s-maxage=21600, stale-while-revalidate=86400"
        : "no-store",
    },
  });
}
