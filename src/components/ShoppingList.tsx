"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { comoLlegar, formatKm } from "@/lib/cercania";
import { calcular, itemDe, type ItemLista } from "@/lib/lista";
import { STORE_IDS, STORES } from "@/lib/stores";
import type { ComparisonGroup, SearchResponse, StoreId } from "@/lib/types";
import { MERCADO_PAGO } from "./CollaborateButton";
import { useCercania } from "./NearestStore";

const LISTA_KEY = "pssj-lista";
const BONO_KEY = "pssj-bono";
export const BONO_MONTO = 1000;
const BONO_DIAS = 30;

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const pesos = (v: number) => money.format(v);

function leer<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    return def;
  }
}
function guardar(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}

/** Bono colaborador guardado en este celular: hasta cuándo vale (ISO). */
export type Bono = { hasta: string; codigo?: string };
export function bonoActivo(b: Bono | null): boolean {
  return !!b && new Date(b.hasta).getTime() > Date.now();
}

type ListaCtx = {
  items: ItemLista[];
  tiene: (ean: string) => boolean;
  agregar: (g: ComparisonGroup) => void;
  quitar: (ean: string) => void;
  vaciar: () => void;
  reemplazar: (items: ItemLista[]) => void;
  bono: Bono | null;
  setBono: (b: Bono | null) => void;
};
const ListaContext = createContext<ListaCtx | null>(null);

export function ListaProvider({ query, children }: { query: string; children: React.ReactNode }) {
  const [items, setItems] = useState<ItemLista[]>([]);
  const [bono, setBonoState] = useState<Bono | null>(null);
  // Se lee después de montar: el servidor no tiene acceso al localStorage del celular.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(leer<ItemLista[]>(LISTA_KEY, []));
    setBonoState(leer<Bono | null>(BONO_KEY, null));
  }, []);
  const cambiar = useCallback((next: ItemLista[]) => {
    setItems(next);
    guardar(LISTA_KEY, next);
  }, []);
  const value = useMemo<ListaCtx>(
    () => ({
      items,
      tiene: (ean) => items.some((i) => i.ean === ean),
      agregar: (g) => {
        if (!items.some((i) => i.ean === g.ean)) cambiar([...items, itemDe(g, query || g.name)]);
      },
      quitar: (ean) => cambiar(items.filter((i) => i.ean !== ean)),
      vaciar: () => cambiar([]),
      reemplazar: cambiar,
      bono,
      setBono: (b) => {
        setBonoState(b);
        guardar(BONO_KEY, b);
      },
    }),
    [items, bono, cambiar, query],
  );
  return <ListaContext.Provider value={value}>{children}</ListaContext.Provider>;
}

function useLista() {
  const ctx = useContext(ListaContext);
  if (!ctx) throw new Error("useLista fuera de ListaProvider");
  return ctx;
}

/** Botón en cada tarjeta de comparación. */
export function AddToListButton({ group }: { group: ComparisonGroup }) {
  const { tiene, agregar, quitar } = useLista();
  const en = tiene(group.ean);
  return (
    <button
      type="button"
      onClick={() => (en ? quitar(group.ean) : agregar(group))}
      className={`mt-2 w-full rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
        en ? "border-violet-300 bg-violet-50 text-violet-800" : "border-violet-600 bg-white text-violet-700 hover:bg-violet-50"
      }`}
    >
      {en ? "✓ En tu lista (quitar)" : "🛒 Agregar a mi lista"}
    </button>
  );
}

/** Vuelve a buscar cada producto y toma los precios de hoy (mismo código de barras). */
async function refrescar(items: ItemLista[]): Promise<{ items: ItemLista[]; sinNovedad: number }> {
  const out: ItemLista[] = [];
  let sinNovedad = 0;
  for (const it of items) {
    try {
      const res = await fetch(`/api/buscar?q=${encodeURIComponent(it.q)}`);
      const data = (await res.json()) as SearchResponse;
      const g = data.comparisons?.find((c) => c.ean === it.ean);
      if (g) out.push({ ...itemDe(g, it.q), name: it.name, image: it.image ?? g.image });
      else {
        out.push(it);
        sinNovedad++;
      }
    } catch {
      out.push(it);
      sinNovedad++;
    }
  }
  return { items: out, sinNovedad };
}

/** Mismo botón de Mercado Pago que «Colaborar con el programador»; al volver, «Ya pagué» activa el bono. */
function Desbloqueo() {
  const { setBono } = useLista();
  const [pago, setPago] = useState(false);
  return (
    <div className="w-full max-w-sm rounded-xl bg-white p-4 text-center shadow-lg ring-2 ring-amber-400">
      <p className="font-bold text-neutral-900">🔒 Colaborá con {pesos(BONO_MONTO)} para desbloquear</p>
      <p className="mt-1 text-sm text-neutral-600">
        Te decimos en qué súper te sale más barata toda la lista, cuánto ahorrás, si conviene repartir la compra y cuál te queda más cerca.
      </p>
      <a
        href={MERCADO_PAGO}
        target="_blank"
        rel="noopener"
        onClick={() => setPago(true)}
        className="mt-3 block rounded-lg bg-[#009ee3] px-4 py-3 font-semibold text-white hover:bg-[#0089c7]"
      >
        Pagar {pesos(BONO_MONTO)} con Mercado Pago
      </a>
      <p className="mt-1 text-[11px] text-neutral-500">Poné {pesos(BONO_MONTO)} como monto. Vale {BONO_DIAS} días en este celular.</p>
      {pago && (
        <button
          type="button"
          onClick={() => setBono({ hasta: new Date(Date.now() + BONO_DIAS * 86400000).toISOString() })}
          className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700"
        >
          ✓ Ya pagué, desbloquear
        </button>
      )}
    </div>
  );
}

export function ShoppingListPanel() {
  const desbloqueo = <Desbloqueo />;
  const { items, quitar, vaciar, reemplazar, bono } = useLista();
  const cerca = useCercania();
  const [abierto, setAbierto] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const activo = bonoActivo(bono);
  const res = useMemo(() => calcular(items, STORE_IDS), [items]);

  const cabecera = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-base font-bold text-violet-900">
          🛒 Lista de compras inteligente{" "}
          {!activo && <span className="ml-1 rounded-full bg-amber-300 px-2 py-0.5 align-middle text-[11px] font-bold text-neutral-900">Bono colaborador {pesos(BONO_MONTO)}</span>}
        </p>
        <p className="mt-0.5 text-sm text-violet-900/80">
          {items.length
            ? `${items.length} ${items.length === 1 ? "producto" : "productos"} en tu lista.`
            : "Tocá «🛒 Agregar a mi lista» en los productos que comprás y te decimos en qué súper te sale más barata toda la compra."}
        </p>
      </div>
      {items.length > 0 && (
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="shrink-0 rounded-lg bg-violet-700 px-4 py-2.5 font-semibold text-white hover:bg-violet-800"
        >
          {abierto ? "Ocultar" : "Ver dónde me conviene"}
        </button>
      )}
    </div>
  );

  if (!items.length || !abierto) {
    return <section className="rounded-xl border-2 border-violet-500 bg-violet-50 p-4 shadow-sm">{cabecera}</section>;
  }

  const mejor = res.completos[0];
  const peor = res.completos[res.completos.length - 1];
  const ahorroRepartir = mejor ? Math.round((mejor.total - res.repartido.total) * 100) / 100 : 0;
  const cercano = (Object.values(cerca).filter(Boolean) as { store: StoreId; km: number }[]).sort((a, b) => a.km - b.km);

  return (
    <section className="rounded-xl border-2 border-violet-500 bg-violet-50 p-4 shadow-sm" aria-live="polite">
      {cabecera}

      <ul className="mt-3 divide-y divide-violet-100 rounded-lg bg-white ring-1 ring-violet-200">
        {items.map((it) => (
          <li key={it.ean} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="min-w-0 truncate">{it.name}</span>
            <button type="button" onClick={() => quitar(it.ean)} className="shrink-0 text-xs font-semibold text-red-600 underline">
              Quitar
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          disabled={actualizando}
          onClick={async () => {
            setActualizando(true);
            setAviso(null);
            const r = await refrescar(items);
            reemplazar(r.items);
            setActualizando(false);
            setAviso(r.sinNovedad ? `${r.sinNovedad} producto(s) no se pudieron actualizar: quedan con el último precio visto.` : "Precios actualizados.");
          }}
          className="font-semibold text-violet-700 underline disabled:opacity-50"
        >
          {actualizando ? "Actualizando precios..." : "Actualizar precios"}
        </button>
        <button type="button" onClick={vaciar} className="font-semibold text-neutral-500 underline">
          Vaciar lista
        </button>
        {aviso && <span className="text-neutral-600">{aviso}</span>}
      </div>

      {!activo ? (
        <div className="relative mt-4">
          <div aria-hidden className="pointer-events-none select-none space-y-2 blur-sm">
            <div className="rounded-lg bg-white p-3 ring-1 ring-violet-200">Supermercado más barato para toda tu compra: ████████ · $ ██.███</div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-violet-200">Ahorrás $ █.███ frente al más caro · repartiendo la compra ahorrás $ ███ más</div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">{desbloqueo}</div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {mejor ? (
            <div className="rounded-lg bg-white p-3 ring-2 ring-emerald-400">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Toda la compra en un solo súper</p>
              <p className="mt-1 text-lg font-bold">
                {STORES[mejor.store].name} · {pesos(mejor.total)}
              </p>
              {peor && peor.store !== mejor.store && (
                <p className="text-sm text-emerald-800">
                  Ahorrás {pesos(peor.total - mejor.total)} frente a {STORES[peor.store].name} ({pesos(peor.total)}).
                </p>
              )}
              {res.completos.length > 1 && (
                <p className="mt-1 text-xs text-neutral-500">
                  {res.completos.map((t) => `${STORES[t.store].name} ${pesos(t.total)}`).join(" · ")}
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-lg bg-white p-3 text-sm ring-1 ring-violet-200">
              Ningún supermercado tiene todos los productos de tu lista. Mirá abajo cómo repartir la compra.
            </p>
          )}

          {res.repartido.porSuper.length > 1 && (!mejor || ahorroRepartir > 0) && (
            <div className="rounded-lg bg-white p-3 ring-1 ring-violet-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Repartiendo la compra</p>
              <p className="mt-1 font-bold">
                {pesos(res.repartido.total)}
                {mejor && ahorroRepartir > 0 && <span className="font-semibold text-emerald-700"> · ahorrás {pesos(ahorroRepartir)} más</span>}
              </p>
              <ul className="mt-1 space-y-1 text-sm">
                {res.repartido.porSuper.map((g) => (
                  <li key={g.store}>
                    <b>{STORES[g.store].name}</b> ({pesos(g.subtotal)}): {g.items.map((i) => i.name).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {res.incompletos.length > 0 && (
            <p className="text-xs text-neutral-500">
              No tienen todo: {res.incompletos.map((t) => `${STORES[t.store].name} (le faltan ${t.faltan.length})`).join(" · ")}.
            </p>
          )}

          {cercano.length > 0 ? (
            <p className="text-sm">
              📍 El más cercano a vos es <b>{STORES[cercano[0].store].name}</b> (a {formatKm(cercano[0].km)}).{" "}
              <a href={comoLlegar(cerca[cercano[0].store]!)} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 underline">
                Cómo llegar
              </a>
            </p>
          ) : (
            <p className="text-xs text-neutral-500">Activá tu ubicación arriba para ver además cuál te queda más cerca.</p>
          )}
          <p className="text-[11px] text-neutral-500">
            Precios de las tiendas online y de la lista de Café América; verificá en el súper. Bono activo hasta el{" "}
            {new Date(bono!.hasta).toLocaleDateString("es-AR")}.
          </p>
        </div>
      )}
    </section>
  );
}
