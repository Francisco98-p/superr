import { STORES } from "./stores";
import type { Product, StoreId } from "./types";
import { unitPriceFromName } from "./units";

const SAN_JUAN_POSTAL_CODE = "5400";
const REQUEST_TIMEOUT_MS = 8000;
const RESULTS_PER_STORE = 24;
const REGION_TTL_MS = 6 * 60 * 60 * 1000;

type ScrapedProduct = Omit<Product, "fetchedAt">;

// Cards show photos at 64-72 px; VTEX can resize on its CDN, so ask for 160 px instead of the original.
const VTEX_THUMB_PX = 160;
function vtexThumb(url: string | undefined): string | null {
  if (!url) return null;
  return url.replace(/\/arquivos\/ids\/(\d+)(?:-\d+-\d+)?\//, `/arquivos/ids/$1-${VTEX_THUMB_PX}-${VTEX_THUMB_PX}/`);
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "es-AR,es;q=0.9",
};

async function request(
  url: string,
  extraHeaders: Record<string, string> = {},
  retries = 1,
): Promise<Response> {
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...extraHeaders },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (res.status >= 500 && retries > 0) return request(url, extraHeaders, retries - 1);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    if (isTimeout && retries > 0) return request(url, extraHeaders, retries - 1);
    throw err;
  }
}

async function getJson<T>(url: string, extraHeaders: Record<string, string> = {}): Promise<T> {
  return (await (await request(url, extraHeaders)).json()) as T;
}

async function getText(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
  return (await request(url, extraHeaders)).text();
}

function withUnitPrice(p: Omit<ScrapedProduct, "unitPrice" | "unitLabel">): ScrapedProduct {
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

async function searchVtex(store: StoreId, query: string): Promise<ScrapedProduct[]> {
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

  const products: ScrapedProduct[] = [];
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
        image: vtexThumb(item.images?.[0]?.imageUrl),
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

async function searchAtomo(query: string): Promise<ScrapedProduct[]> {
  const { site } = STORES.atomo;
  const params = new URLSearchParams({
    controller: "search",
    s: query,
    resultsPerPage: String(RESULTS_PER_STORE),
  });

  const data = await getJson<{ products?: PrestaProduct[] }>(`${site}/busqueda?${params}`, {
    "X-Requested-With": "XMLHttpRequest",
  });

  const products: ScrapedProduct[] = [];
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

// ---------- HTML (La Anónima) ----------

// Branch 180 is the San Juan store (ex Hiper Libertad); prices are per branch.
const LA_ANONIMA_COOKIE = "Id-Sucursal-Super=180; codigoPostal=5400; seleccionocp=1";
const LA_ANONIMA_EAN_CACHE_MAX = 5000;
const laAnonimaEanCache = new Map<string, string | null>();

const HTML_ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

function decodeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, (match, name) => HTML_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

/** "3.150" + "00" -> 3150 */
function parseArPrice(integer: string, decimals?: string): number {
  return Number(integer.replace(/\./g, "")) + (decimals ? Number(`0.${decimals}`) : 0);
}

/** The listing has no barcode, so it is read from each product page (and cached). */
async function getLaAnonimaEan(productId: string, url: string): Promise<string | null> {
  if (laAnonimaEanCache.has(productId)) return laAnonimaEanCache.get(productId) ?? null;
  try {
    const html = await getText(url, { Cookie: LA_ANONIMA_COOKIE });
    const ean = html.match(/data-flix-ean="(\d{8,14})"/)?.[1] ?? null;
    if (laAnonimaEanCache.size >= LA_ANONIMA_EAN_CACHE_MAX) laAnonimaEanCache.clear();
    laAnonimaEanCache.set(productId, ean);
    return ean;
  } catch {
    return null;
  }
}

async function searchLaAnonima(query: string): Promise<ScrapedProduct[]> {
  const { site } = STORES.laanonima;
  const html = await getText(`${site}/buscar/${encodeURIComponent(query)}`, {
    Accept: "text/html,application/xhtml+xml",
    Cookie: LA_ANONIMA_COOKIE,
  });

  const parsed: { id: string; product: Omit<ScrapedProduct, "unitPrice" | "unitLabel"> }[] = [];
  for (const block of html.split('<div id-codigo-producto="').slice(1)) {
    if (parsed.length >= RESULTS_PER_STORE) break;

    const id = block.match(/^(\d+)/)?.[1];
    const path = block.match(/<a href="(\/[^"]*\/art_\d+\/)"/)?.[1];
    const title = block.match(/<h2 class="titulo">([\s\S]*?)<\/h2>/)?.[1];
    // "precio plus" is only paid with La Anónima's own card; everyone else pays the crossed-out price.
    const priceMatch = block.match(
      /<div class="precio(?: (\w+))?\s*">[\s\S]*?<span>\$ ([\d.]+)<span class="decimal">,(\d+)/,
    );
    if (!id || !path || !title || !priceMatch) continue;

    const crossed = block.match(/<span class="tachado">\$ ([\d.]+)(?:<span class="decimal">,(\d+))?/);
    const crossedPrice = crossed ? parseArPrice(crossed[1], crossed[2]) : null;
    const listedPrice = parseArPrice(priceMatch[2], priceMatch[3]);
    const isCardOnlyPrice = priceMatch[1] === "plus";

    const price = isCardOnlyPrice && crossedPrice ? crossedPrice : listedPrice;
    if (!price) continue;

    parsed.push({
      id,
      product: {
        store: "laanonima",
        name: decodeHtml(title),
        brand: null,
        ean: null,
        price,
        regularPrice: !isCardOnlyPrice && crossedPrice && crossedPrice > price ? crossedPrice : null,
        image: block.match(/<img data-src="([^"]+)"/)?.[1] ?? null,
        url: `${site}${path}`,
      },
    });
  }

  const eans = await Promise.all(parsed.map(({ id, product }) => getLaAnonimaEan(id, product.url)));
  return parsed.map(({ product }, i) => withUnitPrice({ ...product, ean: eans[i] }));
}

export function searchStore(store: StoreId, query: string): Promise<ScrapedProduct[]> {
  if (store === "atomo") return searchAtomo(query);
  if (store === "laanonima") return searchLaAnonima(query);
  return searchVtex(store, query);
}
