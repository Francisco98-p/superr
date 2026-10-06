import { getCachedOffers } from "@/lib/offers";
import type { OffersResponse } from "@/lib/types";

export const maxDuration = 60;

export async function GET() {
  const cached = await getCachedOffers();
  const body: OffersResponse = cached ?? { fetchedAt: new Date().toISOString(), offers: [] };

  return Response.json(body, {
    headers: {
      "Cache-Control": cached
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "no-store",
    },
  });
}
