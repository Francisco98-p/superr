import { STORES } from "./stores";
import type { Product, StoreId } from "./types";
import { unitPriceFromName } from "./units";

const SAN_JUAN_POSTAL_CODE = "5400";
const REQUEST_TIMEOUT_MS = 8000;
const RESULTS_PER_STORE = 24;
const REGION_TTL_MS = 6 * 60 * 60 * 1000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "es-AR,es;q=0.9",
};

async function getJson<T>(
  url: string,
  extraHeaders: Record<string, string> = {},
  retries = 1,
): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...extraHeaders },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status >= 500 && retries > 0) return getJson<T>(url, extraHeaders, retries - 1);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    if (isTimeout && retries > 0) return getJson<T>(url, extraHeaders, retries - 1);
    throw err;
  }
}

function withUnitPrice(p: Omit<Product, "unitPrice" | "unitLabel">): Product {
  const unit = unitPriceFromName(p.name, p.price);
  return { ...p, unitPrice: unit?.unitPrice ?? null, unitLabel: unit?.unitLabel ?? null };
}

// ---------- VTEX (Carrefour, ChangoMás, Vea) ----------

type VtexOffer = {
  Price: number;
  PriceWithoutDiscount?: number;
  AvailableQuantity: number;
};

type VtexProduct = {
  productName: string;
  brand?: string;
  link?: string;
  linkText?: string;
  items: {
    ean?: string;
    images?: { imageUrl: string }[];
    sellers: { commertialOffer: VtexOffer }[];
  }[];
};

const regionCache = new Map<string, { id: string | null; at: number }>();

/** VTEX region for San Juan, so prices match the local branch. */
async function getSanJuanRegion(site: string): Promise<string | null> {
  const cached = regionCache.get(site);
  if (cached && Date.now() - cached.at < REGION_TTL_MS) return cached.id;

  let id: string | null = null;
  try {
    const regions = await getJson<{ id: string }[]>(
      `${site}/api/checkout/pub/regions?country=ARG&postalCode=${SAN_JUAN_POSTAL_CODE}`,
    );
    id = regions[0]?.id ?? null;
  } catch {
    id = null;
  }
  regionCache.set(site, { id, at: Date.now() });
  return id;
}

async function searchVtex(store: StoreId, query: string): Promise<Product[]> {
  const { site, priceScope } = STORES[store];
  const params = new URLSearchParams({
    query,
    count: String(RESULTS_PER_STORE),
    page: "1",
    // Some stores map terms like "aceite" to a category redirect with zero products.
    allowRedirect: "false",
  });

  if (priceScope === "san-juan") {
    const region = await getSanJuanRegion(site);
    if (region) params.set("regionId", region);
  }

  const data = await getJson<{ products?: VtexProduct[] }>(
    `${site}/api/io/_v/api/intelligent-search/product_search/?${params}`,
  );

  const products: Product[] = [];
  for (const p of data.products ?? []) {
    const item = p.items?.[0];
    const offer = item?.sellers?.[0]?.commertialOffer;
    if (!item || !offer || !offer.Price || offer.AvailableQuantity <= 0) continue;

    const regular = offer.PriceWithoutDiscount ?? null;
    const path = p.link ?? (p.linkText ? `/${p.linkText}/p` : "");

    products.push(
      withUnitPrice({
        store,
        name: p.productName,
        brand: p.brand ?? null,
        ean: item.ean || null,
        price: offer.Price,
        regularPrice: regular && regular > offer.Price ? regular : null,
        image: item.images?.[0]?.imageUrl ?? null,
        url: `${site}${path}`,
      }),
    );
  }
  return products;
}

// ---------- PrestaShop (Átomo) ----------

type PrestaProduct = {
  name: string;
  price_amount: number;
  regular_price_amount?: number;
  url: string;
  cover?: { medium?: { url: string } } | null;
};

async function searchAtomo(query: string): Promise<Product[]> {
  const { site } = STORES.atomo;
  const params = new URLSearchParams({
    controller: "search",
    s: query,
    resultsPerPage: String(RESULTS_PER_STORE),
  });

  const data = await getJson<{ products?: PrestaProduct[] }>(`${site}/busqueda?${params}`, {
    "X-Requested-With": "XMLHttpRequest",
  });

  const products: Product[] = [];
  for (const p of data.products ?? []) {
    if (!p.price_amount) continue;
    const ean = p.url.match(/-(\d{8,14})\.html$/)?.[1] ?? null;
    const regular = p.regular_price_amount ?? null;

    products.push(
      withUnitPrice({
        store: "atomo",
        name: p.name,
        brand: null,
        ean,
        price: p.price_amount,
        regularPrice: regular && regular > p.price_amount ? regular : null,
        image: p.cover?.medium?.url ?? null,
        url: p.url,
      }),
    );
  }
  return products;
}

export function searchStore(store: StoreId, query: string): Promise<Product[]> {
  return store === "atomo" ? searchAtomo(query) : searchVtex(store, query);
}
