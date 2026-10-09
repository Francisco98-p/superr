import { parsePresentation, presentationMismatch, type Presentation } from "./presentation";
import { searchStore } from "./scrapers";
import { STORE_IDS } from "./stores";
import type { ComparisonGroup, DiscardedGroup, Product, SearchResponse, StoreResult } from "./types";

// A store that takes longer than this is reported as not answering, so the rest still show up.
const STORE_DEADLINE_MS = 14000;

function normalizeEan(ean: string | null): string | null {
  if (!ean) return null;
  const digits = ean.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length >= 7 ? digits : null;
}

// La Anónima's image CDN often blocks hotlinked requests, so use its photos last.
function pickImage(offers: Product[]): string | null {
  const withImage = offers.filter((o) => o.image);
  return (withImage.find((o) => o.store !== "laanonima") ?? withImage[0])?.image ?? null;
}

type Listing = { product: Product; presentation: Presentation };

/**
 * Largest set of listings that are mutually the same presentation, preferring more stores.
 * The same barcode is sometimes reused for another size or pack, so the barcode alone is not enough.
 */
function samePresentation(listings: Listing[]): { kept: Listing[]; dropped: { listing: Listing; reason: string }[] } {
  let best: Listing[] = [];
  for (const seed of listings) {
    const cluster = [seed];
    for (const other of listings) {
      if (other === seed) continue;
      if (cluster.every((c) => !presentationMismatch(c.presentation, other.presentation))) cluster.push(other);
    }
    const stores = (l: Listing[]) => new Set(l.map((x) => x.product.store)).size;
    if (stores(cluster) > stores(best) || (stores(cluster) === stores(best) && cluster.length > best.length)) best = cluster;
  }
  const dropped = listings
    .filter((l) => !best.includes(l))
    .map((listing) => ({
      listing,
      reason: best.map((b) => presentationMismatch(b.presentation, listing.presentation)).find(Boolean) ?? "Presentación distinta",
    }));
  return { kept: best, dropped };
}

function buildComparisons(products: Product[]): { comparisons: ComparisonGroup[]; discarded: DiscardedGroup[] } {
  const byEan = new Map<string, Listing[]>();
  for (const product of products) {
    const ean = normalizeEan(product.ean);
    if (!ean) continue;
    const list = byEan.get(ean) ?? [];
    list.push({ product, presentation: parsePresentation(product.name) });
    byEan.set(ean, list);
  }

  const groups: ComparisonGroup[] = [];
  const discarded: DiscardedGroup[] = [];
  for (const [ean, listings] of byEan) {
    if (new Set(listings.map((l) => l.product.store)).size < 2) continue;
    const { kept, dropped } = samePresentation(listings);

    // Keep only the cheapest offer per store for each barcode.
    const perStore = new Map<string, Product>();
    for (const { product } of kept) {
      const prev = perStore.get(product.store);
      if (!prev || product.price < prev.price) perStore.set(product.store, product);
    }
    const offers = [...perStore.values()].sort((a, b) => a.price - b.price);

    if (dropped.length) {
      discarded.push({
        ean,
        kept: offers.map((o) => ({ store: o.store, name: o.name })),
        dropped: dropped.map(({ listing, reason }) => ({
          store: listing.product.store,
          name: listing.product.name,
          price: listing.product.price,
          reason,
        })),
      });
    }
    if (offers.length < 2) continue;

    const prices = offers.map((o) => o.price);
    groups.push({
      ean,
      name: offers.reduce((a, b) => (b.name.length > a.name.length ? b : a)).name,
      image: pickImage(offers),
      offers,
      cheapest: offers[0].store,
      savings: Math.max(...prices) - Math.min(...prices),
    });
  }

  return {
    comparisons: groups.sort((a, b) => b.offers.length - a.offers.length || b.savings - a.savings),
    discarded,
  };
}

function withDeadline<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Tardó demasiado en responder")), ms);
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

export async function searchAll(query: string): Promise<SearchResponse> {
  const settled = await Promise.allSettled(
    STORE_IDS.map(async (id) => {
      const list = await withDeadline(searchStore(id, query), STORE_DEADLINE_MS);
      const fetchedAt = new Date().toISOString();
      return list.map((p) => ({ ...p, fetchedAt }));
    }),
  );

  const stores: StoreResult[] = [];
  const products: Product[] = [];

  settled.forEach((result, i) => {
    const store = STORE_IDS[i];
    if (result.status === "fulfilled") {
      stores.push({ store, ok: true, count: result.value.length });
      products.push(...result.value);
    } else {
      const reason = result.reason;
      stores.push({
        store,
        ok: false,
        count: 0,
        error: reason instanceof Error ? reason.message : "Error desconocido",
      });
    }
  });

  products.sort((a, b) => a.price - b.price);

  return {
    query,
    fetchedAt: new Date().toISOString(),
    stores,
    ...buildComparisons(products),
    products,
  };
}
