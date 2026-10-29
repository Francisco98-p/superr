"use client";

import { createContext, useContext, useState } from "react";
import { comoLlegar, formatKm, masCercanas, type Cercana } from "@/lib/cercania";
import { STORES } from "@/lib/stores";
import type { StoreId } from "@/lib/types";

/** Closest branch of each supermarket once the visitor shared their location (empty until then). */
export const CercaniaContext = createContext<Partial<Record<StoreId, Cercana>>>({});

export function useCercania() {
  return useContext(CercaniaContext);
}

/** "a 1,2 km" next to a store in the results, when the location is known. */
export function DistanciaTag({ store }: { store: StoreId }) {
  const c = useCercania()[store];
  if (!c) return null;
  return <span className="text-[11px] font-medium text-sky-700">📍 a {formatKm(c.km)}</span>;
}

type Estado =
  | { tipo: "inicio" }
  | { tipo: "buscando" }
  | { tipo: "listo"; lista: Cercana[] }
  | { tipo: "error"; titulo: string; detalle: string };

// Más allá de esta distancia de la sucursal más cercana, el visitante no está en el Gran San Juan.
const LEJOS_KM = 40;

export default function NearestStore({ onCercania }: { onCercania: (c: Partial<Record<StoreId, Cercana>>) => void }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "inicio" });

  function ubicar() {
    if (!("geolocation" in navigator)) {
      setEstado({ tipo: "error", titulo: "Tu navegador no permite usar la ubicación", detalle: "Probá desde Chrome o Safari en el celular." });
      return;
    }
    setEstado({ tipo: "buscando" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lista = masCercanas(pos.coords.latitude, pos.coords.longitude);
        onCercania(Object.fromEntries(lista.map((c) => [c.store, c])));
        setEstado({ tipo: "listo", lista });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setEstado({
            tipo: "error",
            titulo: "No diste permiso para usar tu ubicación",
            detalle:
              "Activá la ubicación del celular (Ajustes → Ubicación) y permitila para este sitio: tocá el candado 🔒 al lado de la dirección de la página → Permisos → Ubicación → Permitir. Después tocá de nuevo el botón.",
          });
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setEstado({
            tipo: "error",
            titulo: "No pudimos saber dónde estás",
            detalle: "Revisá que la ubicación (GPS) del celular esté activada y volvé a intentar.",
          });
        } else {
          setEstado({ tipo: "error", titulo: "La ubicación tardó demasiado", detalle: "Revisá que la ubicación del celular esté activada y volvé a intentar." });
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  if (estado.tipo === "listo") {
    const [cerca, ...resto] = estado.lista;
    const lejos = cerca.km > LEJOS_KM;
    return (
      <section className="rounded-xl border-2 border-sky-500 bg-sky-50 p-4 shadow-sm" aria-live="polite">
        {lejos ? (
          <p className="text-sm text-sky-900">
            Parece que no estás en San Juan: el súper más cercano de la lista queda a {formatKm(cerca.km)}.
          </p>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">📍 El súper más cercano a vos</p>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-neutral-900">
                  {STORES[cerca.store].name} <span className="text-sky-700">· a {formatKm(cerca.km)}</span>
                </p>
                <p className="text-sm text-neutral-600">{cerca.direccion}</p>
              </div>
              <a
                href={comoLlegar(cerca)}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                Cómo llegar
              </a>
            </div>
          </>
        )}
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {(lejos ? estado.lista : resto).map((c) => (
            <li key={c.store}>
              <a
                href={comoLlegar(c)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-sky-200 hover:ring-sky-400"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{STORES[c.store].name}</span>
                  <span className="block truncate text-xs text-neutral-500">{c.direccion}</span>
                </span>
                <span className="shrink-0 font-semibold text-sky-700">{formatKm(c.km)}</span>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-neutral-500">
            Distancia en línea recta desde donde estás. Tu ubicación no se guarda ni sale de tu celular.
          </p>
          <button type="button" onClick={ubicar} className="text-xs font-semibold text-sky-700 underline">
            Actualizar ubicación
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-sky-500 bg-sky-50 p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-base font-bold text-sky-900">📍 ¿Qué súper te queda más cerca?</p>
        {estado.tipo === "error" ? (
          <p className="mt-0.5 text-sm text-red-700">
            <strong>{estado.titulo}.</strong> {estado.detalle}
          </p>
        ) : (
          <p className="mt-0.5 text-sm text-sky-900/80">
            Activá la ubicación del celular y te mostramos el supermercado más cercano y cómo llegar.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={ubicar}
        disabled={estado.tipo === "buscando"}
        className="shrink-0 rounded-lg bg-sky-600 px-4 py-2.5 font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
      >
        {estado.tipo === "buscando" ? "Buscando tu ubicación..." : estado.tipo === "error" ? "Intentar de nuevo" : "Usar mi ubicación"}
      </button>
    </section>
  );
}
