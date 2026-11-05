"use client";

import { use, useState } from "react";
import { useLista } from "./ShoppingList";
import type { RecetaDelDia } from "@/lib/recetas";
import { STORES } from "@/lib/stores";

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/** "¿Qué cocino hoy?": una receta casera por día con lo que cuesta comprando cada ingrediente donde es más barato. */
export default function RecetaHoy({ receta }: { receta: Promise<RecetaDelDia | null> }) {
  const r = use(receta);
  const { agregarVarios } = useLista();
  const [agregados, setAgregados] = useState<number | null>(null);
  if (!r) return null;

  const conPrecio = r.ingredientes.filter((i) => i.group && i.costo !== null);
  const agregar = () => {
    setAgregados(agregarVarios(conPrecio.map((i) => i.group!)));
    setTimeout(() => document.getElementById("lista-inteligente")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
  };

  return (
    <section aria-labelledby="receta-hoy-titulo">
      <div className="mb-3">
        <h2 id="receta-hoy-titulo" className="text-lg font-bold">
          ¿Qué cocino hoy?
        </h2>
        <p className="text-sm text-neutral-500">Una comida casera por día, con lo que cuesta en los supermercados de San Juan.</p>
      </div>
      <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-bold text-neutral-900">{r.nombre}</p>
            <p className="mt-0.5 text-sm text-neutral-500">Para {r.porciones} personas</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-700">{money.format(r.total)}</p>
            <p className="text-xs text-neutral-500">{money.format(r.porPorcion)} por persona</p>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-black/5 text-sm">
          {r.ingredientes.map((i) => (
            <li key={i.nombre} className="flex items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-medium text-neutral-800">{i.nombre}</span>
                {i.group && (
                  <span className="block truncate text-xs text-neutral-500">
                    {i.group.name} · más barato en {STORES[i.group.offers[0].store]?.name ?? i.group.offers[0].store}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-neutral-900">
                {i.costo !== null ? money.format(i.costo) : <span className="font-normal text-neutral-400">sin precio</span>}
              </span>
            </li>
          ))}
        </ul>

        {r.frescos.length > 0 && (
          <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            <strong className="font-semibold">De verdulería o carnicería</strong> (no está en el total): {r.frescos.join(", ")}.
          </p>
        )}

        <details className="mt-3 text-sm text-neutral-700">
          <summary className="cursor-pointer font-medium text-emerald-800">Cómo se hace</summary>
          <p className="mt-1.5">{r.pasos}</p>
        </details>

        <button
          type="button"
          onClick={agregar}
          disabled={!conPrecio.length}
          className="mt-4 w-full rounded-lg border border-violet-600 px-4 py-2.5 font-semibold text-violet-700 transition hover:bg-violet-50 disabled:opacity-50"
        >
          🛒 Agregar los ingredientes a mi lista
        </button>
        {agregados !== null && (
          <p className="mt-2 text-center text-xs text-neutral-600" role="status">
            {agregados ? `Agregué ${agregados} ${agregados === 1 ? "producto" : "productos"} a tu lista.` : "Esos productos ya estaban en tu lista."}
          </p>
        )}
        <p className="mt-3 text-[11px] text-neutral-500">
          El total es lo que cuesta la cantidad que usa la receta, comprando cada producto donde está más barato. Mañana, otra receta.
        </p>
      </div>
    </section>
  );
}
