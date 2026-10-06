import { unstable_cache } from "next/cache";
import { searchAll } from "./search";
import type { Offer, OffersResponse } from "./types";

const OFFER_QUERIES = [
  "leche",
  "yerba",
  "aceite",
  "arroz",
  "fideos",
  "azucar",
  "harina",
  "cafe",
  "galletitas",
  "detergente",
];
// Few searches at a time so the stores don't see a burst of requests.
const BATCH_SIZE = 3;
const MAX_OFFERS = 12;
const MAX_PER_QUERY = 3;
const MIN_STORES = 3;
// Bigger gaps are almost always a pack-size mismatch under the same barcode.
const MAX_SAVINGS_PCT = 0.6;

/** Products sold in several stores with the biggest price gap, across everyday searches. */
export async function getBestOffers(): Promise<Offer[]> {
  const candidates: (Offer & { query: string })[] = [];

  for (let i = 0; i < OFFER_QUERIES.length; i += BATCH_SIZE) {
    const batch = OFFER_QUERIES.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((q) => searchAll(q)));
    results.forEach((result, j) => {
      for (const group of result.comparisons) {
        if (group.offers.length < MIN_STORES || group.savings <= 0) continue;
        const highest = Math.max(...group.offers.map((o) => o.price));
        const savingsPct = group.savings / highest;
        if (savingsPct > MAX_SAVINGS_PCT) continue;
        candidates.push({ ...group, savingsPct, query: batch[j] });
      }
    });
  }

  candidates.sort((a, b) => b.savingsPct - a.savingsPct);

  const seen = new Set<string>();
  const perQuery = new Map<string, number>();
  const offers: Offer[] = [];
  for (const { query, ...offer } of candidates) {
    if (seen.has(offer.ean) || (perQuery.get(query) ?? 0) >= MAX_PER_QUERY) continue;
    seen.add(offer.ean);
    perQuery.set(query, (perQuery.get(query) ?? 0) + 1);
    offers.push(offer);
    if (offers.length >= MAX_OFFERS) break;
  }
  return offers;
}

const OFFERS_REVALIDATE_S = 6 * 60 * 60;

// Shared by every visitor and kept across deploys; after 6 h the stale copy is
// still served while a fresh one is computed in the background.
const cachedOffers = unstable_cache(
  async (): Promise<OffersResponse> => {
    const offers = await getBestOffers();
    // Throwing keeps an empty result (stores down) out of the cache.
    if (offers.length === 0) throw new Error("No offers found");
    return { fetchedAt: new Date().toISOString(), offers };
  },
  ["best-offers-v1"],
  { revalidate: OFFERS_REVALIDATE_S },
);

/** Cached best offers, or null when they can't be computed right now. */
export async function getCachedOffers(): Promise<OffersResponse | null> {
  try {
    return await cachedOffers();
  } catch {
    return null;
  }
}
