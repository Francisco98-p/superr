import { unstable_cache } from "next/cache";
import { searchAll } from "./search";
import type { ExcludedOffer, Offer, OffersResponse } from "./types";

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
// Bigger gaps are almost always a data error (wrong pack, stale or placeholder price): left out.
const MAX_SAVINGS_PCT = 0.6;
// From here on the gap is shown with a "check at the store" warning.
const VERIFY_SAVINGS_PCT = 0.4;
// Cheapest price below this share of the median of the other stores looks out of line.
const OUTLIER_RATIO = 0.6;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** Products sold in several stores with the biggest price gap, across everyday searches. */
export async function getBestOffers(): Promise<{ offers: Offer[]; excluded: ExcludedOffer[] }> {
  const candidates: (Offer & { query: string })[] = [];
  const excluded: ExcludedOffer[] = [];

  for (let i = 0; i < OFFER_QUERIES.length; i += BATCH_SIZE) {
    const batch = OFFER_QUERIES.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((q) => searchAll(q)));
    results.forEach((result, j) => {
      for (const group of result.comparisons) {
        if (group.offers.length < MIN_STORES || group.savings <= 0) continue;
        const highest = Math.max(...group.offers.map((o) => o.price));
        const savingsPct = group.savings / highest;
        if (savingsPct > MAX_SAVINGS_PCT) {
          if (!excluded.some((e) => e.ean === group.ean)) {
            excluded.push({
              ean: group.ean,
              name: group.name,
              savingsPct,
              reason: "Diferencia de más del 60%: probable error de carga o precio desactualizado",
              offers: group.offers.map((o) => ({ store: o.store, name: o.name, price: o.price })),
            });
          }
          continue;
        }
        const [cheapest, ...rest] = group.offers.map((o) => o.price);
        const verify = savingsPct > VERIFY_SAVINGS_PCT || cheapest < median(rest) * OUTLIER_RATIO;
        candidates.push({ ...group, savingsPct, verify, query: batch[j] });
      }
    });
  }

  // Reliable gaps first; the ones to double-check go after them.
  candidates.sort((a, b) => Number(a.verify) - Number(b.verify) || b.savingsPct - a.savingsPct);

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
  return { offers, excluded };
}

const OFFERS_REVALIDATE_S = 6 * 60 * 60;

// Shared by every visitor and kept across deploys; after 6 h the stale copy is
// still served while a fresh one is computed in the background.
const cachedOffers = unstable_cache(
  async (): Promise<OffersResponse> => {
    const { offers, excluded } = await getBestOffers();
    // Throwing keeps an empty result (stores down) out of the cache.
    if (offers.length === 0) throw new Error("No offers found");
    return { fetchedAt: new Date().toISOString(), offers, excluded };
  },
  ["best-offers-v3"],
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
