"use client";

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeQuery } from "@/lib/query";
import { STORE_IDS, STORES } from "@/lib/stores";
import type { ComparisonGroup, OffersResponse, Product, SearchResponse, StoreId } from "@/lib/types";

const QUICK_SEARCHES = ["leche", "pan", "aceite", "yerba", "arroz", "fideos", "azúcar", "harina"];

type SortMode = "price" | "unit";

const money = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatPrice(value: number) {
  return money.format(value);
}

type SearchOutcome = { data: SearchResponse | null; error: string | null };

/** Resolves to null when the request was aborted by a newer search. */
async function requestSearch(query: string, signal: AbortSignal): Promise<SearchOutcome | null> {
  try {
    const res = await fetch(`/api/buscar?q=${encodeURIComponent(query)}`, { signal });
    const body = await res.json();
    if (!res.ok) return { data: null, error: body.error ?? "No se pudo buscar." };
    return { data: body as SearchResponse, error: null };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    return { data: null, error: "No se pudo conectar. Probá de nuevo." };
  }
}

function StoreBadge({ store }: { store: StoreId }) {
  const s = STORES[store];
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
      style={{ backgroundColor: s.color }}
    >
      {s.name}
    </span>
  );
}

/** Tries each candidate photo in order and falls back to a placeholder when all fail. */
function ProductImage({ srcs, alt, size }: { srcs: (string | null)[]; alt: string; size: number }) {
  const candidates = [...new Set(srcs.filter((s): s is string => !!s))];
  const [failed, setFailed] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const src = candidates[failed] ?? null;

  // A server-rendered <img> can fail before hydration, when onError isn't attached yet.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setFailed((n) => n + 1);
  }, [src]);

  if (!src) {
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded bg-neutral-100 text-[10px] text-neutral-400"
        style={{ width: size, height: size }}
      >
        Sin foto
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={imgRef}
      key={src}
      src={src}
      alt={alt}
      onError={() => setFailed((n) => n + 1)}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded bg-white object-contain"
      style={{ width: size, height: size }}
    />
  );
}

function ComparisonCard({ group, savingsPct }: { group: ComparisonGroup; savingsPct?: number }) {
  const cheapest = group.offers[0];
  return (
    <article className="relative flex flex-col rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      {savingsPct !== undefined && (
        <span className="absolute -top-2 right-3 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white shadow">
          -{Math.round(savingsPct * 100)}%
        </span>
      )}
      <div className="flex gap-3">
        <ProductImage srcs={[group.image, ...group.offers.map((o) => o.image)]} alt={group.name} size={72} />
        <div className="min-w-0">
          <h3 className="line-clamp-3 text-sm font-semibold leading-snug">{group.name}</h3>
          {group.savings > 0 && (
            <p className="mt-1 text-xs font-medium text-emerald-700">
              Ahorrás hasta {formatPrice(group.savings)} comprando en {STORES[cheapest.store].name}
            </p>
          )}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {group.offers.map((offer) => {
          const isCheapest = offer.store === group.cheapest;
          return (
            <li key={offer.store}>
              <a
                href={offer.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm transition hover:ring-1 hover:ring-black/20 ${
                  isCheapest ? "bg-emerald-50 ring-1 ring-emerald-300" : "bg-neutral-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <StoreBadge store={offer.store} />
                  {isCheapest && <span className="text-[11px] font-semibold text-emerald-700">Más barato</span>}
                </span>
                <span className={`font-semibold tabular-nums ${isCheapest ? "text-emerald-700" : ""}`}>
                  {formatPrice(offer.price)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <a
      href={product.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 rounded-xl border border-black/10 bg-white p-3 shadow-sm transition hover:border-emerald-400"
    >
      <ProductImage srcs={[product.image]} alt={product.name} size={64} />
      <div className="flex min-w-0 flex-1 flex-col">
        <StoreBadge store={product.store} />
        <h3 className="mt-1 line-clamp-2 text-sm leading-snug">{product.name}</h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1">
          <span className="text-base font-bold tabular-nums">{formatPrice(product.price)}</span>
          {product.regularPrice && (
            <span className="text-xs text-neutral-400 line-through tabular-nums">
              {formatPrice(product.regularPrice)}
            </span>
          )}
          {product.unitPrice && (
            <span className="text-xs text-neutral-500 tabular-nums">
              {formatPrice(product.unitPrice)}/{product.unitLabel}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}

const updatedAt = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/San_Juan",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function OfferCardSkeleton() {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="size-[72px] shrink-0 animate-pulse rounded bg-neutral-100" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-3/5 animate-pulse rounded bg-emerald-50" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-neutral-50" />
        ))}
      </div>
    </div>
  );
}

function OffersHeader({ fetchedAt }: { fetchedAt?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-lg font-bold">Mejores ofertas de hoy</h2>
        <p className="text-sm text-neutral-500">
          Productos de todos los días con la mayor diferencia de precio entre supermercados.
        </p>
      </div>
      {fetchedAt && (
        <p className="text-xs text-neutral-400" suppressHydrationWarning>
          Precios actualizados a las {updatedAt.format(new Date(fetchedAt))} h
        </p>
      )}
    </div>
  );
}

function BestOffersLoading() {
  return (
    <section>
      <OffersHeader />
      <p className="mb-3 flex items-center gap-2 text-sm text-emerald-800">
        <span className="size-2 animate-ping rounded-full bg-emerald-600" />
        Comparando precios en {STORE_IDS.length} supermercados...
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <OfferCardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

function BestOffers({ offers, onSearch }: { offers: Promise<OffersResponse | null>; onSearch: (q: string) => void }) {
  const result = use(offers);

  if (!result || result.offers.length === 0) {
    return (
      <section>
        <OffersHeader />
        <div className="rounded-xl border border-black/10 bg-white p-4 text-sm text-neutral-600 shadow-sm">
          <p>Los supermercados están tardando en responder y no pudimos armar las ofertas ahora.</p>
          <p className="mt-1">Mientras tanto, compará un producto:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_SEARCHES.slice(0, 4).map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => onSearch(term)}
                className="rounded-full bg-emerald-700 px-3 py-1 text-sm font-medium text-white transition hover:bg-emerald-800"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <OffersHeader fetchedAt={result.fetchedAt} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.offers.map((offer) => (
          <ComparisonCard key={offer.ean} group={offer} savingsPct={offer.savingsPct} />
        ))}
      </div>
    </section>
  );
}

export default function PriceSearch({
  initialQuery,
  offers,
}: {
  initialQuery: string;
  offers: Promise<OffersResponse | null>;
}) {
  const hasInitialQuery = initialQuery.trim().length >= 2;
  const [input, setInput] = useState(initialQuery);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(hasInitialQuery);
  const [error, setError] = useState<string | null>(null);
  const [hiddenStores, setHiddenStores] = useState<Set<StoreId>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("price");
  const abortRef = useRef<AbortController | null>(null);

  const fetchResults = useCallback((query: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    requestSearch(query, controller.signal).then((outcome) => {
      if (!outcome || abortRef.current !== controller) return;
      setData(outcome.data);
      setError(outcome.error);
      setLoading(false);
    });
  }, []);

  const runSearch = (raw: string) => {
    const query = normalizeQuery(raw);
    if (query.length < 2) {
      setError("Escribí al menos 2 letras.");
      return;
    }
    setInput(query);
    setLoading(true);
    setError(null);
    window.history.replaceState(null, "", `?q=${encodeURIComponent(query)}`);
    fetchResults(query);
  };

  useEffect(() => {
    if (hasInitialQuery) fetchResults(normalizeQuery(initialQuery));
    return () => abortRef.current?.abort();
  }, [hasInitialQuery, initialQuery, fetchResults]);

  const visibleProducts = useMemo(() => {
    if (!data) return [];
    const list = data.products.filter((p) => !hiddenStores.has(p.store));
    if (sortMode === "unit") {
      return [...list].sort((a, b) => (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity));
    }
    return list;
  }, [data, hiddenStores, sortMode]);

  const toggleStore = (store: StoreId) => {
    setHiddenStores((prev) => {
      const next = new Set(prev);
      if (next.has(store)) next.delete(store);
      else next.add(store);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(input);
          }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: leche la serenísima, yerba playadito, aceite cocinero..."
            maxLength={60}
            aria-label="Producto a buscar"
            className="min-w-0 flex-1 rounded-lg border border-black/15 px-3 py-2.5 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_SEARCHES.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => runSearch(term)}
              className="rounded-full border border-emerald-700/30 bg-emerald-50 px-3 py-1 text-sm text-emerald-800 transition hover:bg-emerald-100"
            >
              {term}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {!data && !loading && (
        <>
          <Suspense fallback={<BestOffersLoading />}>
            <BestOffers offers={offers} onSearch={runSearch} />
          </Suspense>
          <section className="rounded-xl border border-dashed border-black/15 bg-white/60 p-6 text-sm text-neutral-600">
            <p className="font-medium text-neutral-800">¿Cómo funciona?</p>
            <p className="mt-1">
              Buscamos el producto en {STORE_IDS.map((id) => STORES[id].name).join(", ")} al mismo tiempo. Cuando
              el mismo producto (mismo código de barras) está en varios supers, te mostramos lado a lado dónde
              conviene comprarlo.
            </p>
          </section>
        </>
      )}

      {loading && !data && (
        <p className="text-center text-sm text-neutral-500">Consultando los supermercados...</p>
      )}

      {data && (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          <section className="flex flex-wrap gap-2 text-xs">
            {data.stores.map((s) => (
              <span
                key={s.store}
                className={`rounded-full border px-2.5 py-1 ${
                  s.ok ? "border-black/10 bg-white text-neutral-700" : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                <span className="font-semibold">{STORES[s.store].name}:</span>{" "}
                {s.ok ? `${s.count} productos` : "no respondió"}
              </span>
            ))}
          </section>

          {data.comparisons.length > 0 && (
            <section>
              <h2 className="text-lg font-bold">Comparación directa</h2>
              <p className="mb-3 text-sm text-neutral-500">
                Mismo producto en distintos supermercados, ordenado por mayor ahorro.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.comparisons.slice(0, 12).map((group) => (
                  <ComparisonCard key={group.ean} group={group} />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Todos los resultados</h2>
                <p className="text-sm text-neutral-500">{visibleProducts.length} productos</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {STORE_IDS.map((id) => {
                  const active = !hiddenStores.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleStore(id)}
                      aria-pressed={active}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        active ? "text-white" : "border-black/15 bg-white text-neutral-400 line-through"
                      }`}
                      style={active ? { backgroundColor: STORES[id].color, borderColor: STORES[id].color } : {}}
                    >
                      {STORES[id].name}
                    </button>
                  );
                })}
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  aria-label="Ordenar"
                  className="rounded-lg border border-black/15 bg-white px-2 py-1 text-sm"
                >
                  <option value="price">Menor precio</option>
                  <option value="unit">Menor precio por kg / litro</option>
                </select>
              </div>
            </div>
            {visibleProducts.length === 0 ? (
              <p className="text-sm text-neutral-500">No encontramos productos. Probá con otra palabra.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((p) => (
                  <ProductCard key={`${p.store}-${p.url}`} product={p} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
