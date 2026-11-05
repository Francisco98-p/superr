"use client";

import { useEffect, useId, useRef } from "react";
import { MERCADO_PAGO } from "./CollaborateButton";

// Mismo link de Mercado Pago que la lista de compras inteligente: la persona pone el monto ($1.000).
const MONTO = "$1.000";

const COUNT_KEY = "pss.busquedas";
const PAID_KEY = "pss.colaboro";
const FIRST_AT = 6; // "más de 5 búsquedas"
const EVERY = 10; // después, cada 10 búsquedas más
const PAID_QUIET_DAYS = 30;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento (modo privado): el cartel simplemente no se cuenta.
  }
}

/**
 * Cartel para colaborar con el programador: aparece cuando la persona ya buscó más de 5 veces
 * (y después cada 10 búsquedas), salvo que haya tocado pagar en los últimos 30 días.
 * `searches` cambia cada vez que termina una búsqueda.
 */
export default function CollaborateNudge({ searches }: { searches: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!searches) return;
    const count = (Number(read(COUNT_KEY)) || 0) + 1;
    write(COUNT_KEY, String(count));
    const paidAt = Number(read(PAID_KEY)) || 0;
    if (paidAt && Date.now() - paidAt < PAID_QUIET_DAYS * 86400000) return;
    const due = count === FIRST_AT || (count > FIRST_AT && (count - FIRST_AT) % EVERY === 0);
    if (due && !dialog.current?.open) dialog.current?.showModal();
  }, [searches]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      className="m-auto w-[min(420px,calc(100%-32px))] rounded-xl p-6 text-neutral-700 backdrop:bg-black/50"
    >
      <p className="text-3xl" aria-hidden="true">
        ☕
      </p>
      <h2 id={titleId} className="mt-2 text-xl font-bold text-neutral-900">
        ¿Te está sirviendo? Colaborá con el programador
      </h2>
      <p className="mt-2 text-sm">
        Ya hiciste varias búsquedas. Este sitio es gratis y sin publicidad, y mantenerlo tiene un costo. Con $1.000 me
        ayudás a que siga funcionando.
      </p>
      <a
        href={MERCADO_PAGO}
        target="_blank"
        rel="noopener"
        onClick={() => {
          write(PAID_KEY, String(Date.now()));
          dialog.current?.close();
        }}
        className="mt-5 block rounded-lg bg-[#009ee3] px-4 py-3.5 text-center text-lg font-bold text-white hover:bg-[#0089c7]"
      >
        Colaborar con {MONTO} por Mercado Pago
      </a>
      <p className="mt-1 text-center text-[11px] text-neutral-500">Poné {MONTO} como monto.</p>
      <button
        type="button"
        onClick={() => dialog.current?.close()}
        className="mt-3 w-full rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium hover:bg-neutral-50"
      >
        Ahora no, seguir buscando
      </button>
      <p className="mt-3 text-center text-xs text-neutral-500">A nombre de Francisco Tejada. ¡Gracias!</p>
    </dialog>
  );
}
