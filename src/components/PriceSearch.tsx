"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function ProductImage({ src, alt, size }: { src: string | null; alt: string; size: number }) {
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
      src={src}
      alt={alt}
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
        <ProductImage src={group.image} alt={group.name} size={72} />
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
      <ProductImage src={product.image} alt={product.name} size={64} />
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

async function requestOffers(): Promise<OffersResponse | null> {
  try {
    const res = await fetch("/api/ofertas");
    return res.ok ? ((await res.json()) as OffersResponse) : null;
  } catch {
    return null;
  }
}

function BestOffers({ offers }: { offers: OffersResponse | null | undefined }) {
  return (
    <section>
      <h2 className="text-lg font-bold">Mejores ofertas de hoy</h2>
      <p className="mb-3 text-sm text-neutral-500">
        Productos de todos los días con la mayor diferencia de precio entre supermercados.
      </p>
      {offers === undefined && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-black/5 bg-white" />
          ))}
        </div>
      )}
      {offers === null && (
        <p className="text-sm text-neutral-500">No pudimos cargar las ofertas. Probá buscando un producto.</p>
      )}
      {offers && offers.offers.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.offers.map((offer) => (
            <ComparisonCard key={offer.ean} group={offer} savingsPct={offer.savingsPct} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function PriceSearch({ initialQuery }: { initialQuery: string }) {
  const hasInitialQuery = initialQuery.trim().length >= 2;
  const [input, setInput] = useState(initialQuery);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(hasInitialQuery);
  const [error, setError] = useState<string | null>(null);
  const [hiddenStores, setHiddenStores] = useState<Set<StoreId>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("price");
  const abortRef = useRef<AbortController | null>(null);
  // undefined = loading, null = failed
  const [offers, setOffers] = useState<OffersResponse | null | undefined>(undefined);

  useEffect(() => {
    requestOffers().then(setOffers);
  }, []);

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
          <BestOffers offers={offers} />
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
