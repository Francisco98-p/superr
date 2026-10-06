import { searchStore } from "./scrapers";
import { STORE_IDS } from "./stores";
import type { ComparisonGroup, Product, SearchResponse, StoreResult } from "./types";

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

function buildComparisons(products: Product[]): ComparisonGroup[] {
  const byEan = new Map<string, Product[]>();
  for (const p of products) {
    const ean = normalizeEan(p.ean);
    if (!ean) continue;
    const list = byEan.get(ean) ?? [];
    // Keep only the cheapest offer per store for each barcode.
    const existing = list.findIndex((o) => o.store === p.store);
    if (existing === -1) list.push(p);
    else if (p.price < list[existing].price) list[existing] = p;
    byEan.set(ean, list);
  }

  const groups: ComparisonGroup[] = [];
  for (const [ean, offers] of byEan) {
    if (offers.length < 2) continue;
    offers.sort((a, b) => a.price - b.price);
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

  return groups.sort(
    (a, b) => b.offers.length - a.offers.length || b.savings - a.savings,
  );
}

export async function searchAll(query: string): Promise<SearchResponse> {
  const settled = await Promise.allSettled(STORE_IDS.map((id) => searchStore(id, query)));

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
    comparisons: buildComparisons(products),
    products,
  };
}
