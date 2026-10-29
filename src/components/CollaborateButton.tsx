"use client";

import { useId, useRef, useState } from "react";

const ALIAS = "francisco.tejada.1";
export const MERCADO_PAGO = "https://link.mercadopago.com.ar/franciscotejada";

export default function CollaborateButton({ variant = "strip" }: { variant?: "strip" | "inline" }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const aliasRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const titleId = useId();

  function open() {
    setCopied(false);
    dialog.current?.showModal();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(ALIAS);
      setCopied(true);
    } catch {
      // Without clipboard access, select the alias so the visitor can copy it by hand.
      const range = document.createRange();
      if (aliasRef.current) range.selectNodeContents(aliasRef.current);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(range);
    }
  }

  return (
    <>
      {variant === "strip" ? (
        <div className="bg-amber-300 text-center">
          <a
            href={MERCADO_PAGO}
            target="_blank"
            rel="noopener"
            className="block w-full px-4 py-2.5 font-bold text-neutral-900 underline underline-offset-4 hover:bg-amber-200"
          >
            ☕ Colaborar con el programador
          </a>
        </div>
      ) : (
        <button type="button" onClick={open} className="font-semibold text-emerald-700 underline">
          Colaborar con el programador
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(420px,calc(100%-32px))] rounded-xl p-6 text-neutral-700 backdrop:bg-black/50"
      >
        <h2 id={titleId} className="text-xl font-bold text-neutral-900">
          Colaborá con el programador
        </h2>
        <p className="mt-2 text-sm">
          Este sitio es gratis y sin publicidad. Si te sirvió, podés colaborar con el monto que quieras:
        </p>
        <a
          href={MERCADO_PAGO}
          target="_blank"
          rel="noopener"
          className="mt-4 block rounded-lg bg-[#009ee3] px-4 py-3 text-center font-semibold text-white hover:bg-[#0089c7]"
        >
          Pagar con Mercado Pago
        </a>
        <p className="mt-4 text-sm">O transferí desde la app de tu banco al alias:</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code
            ref={aliasRef}
            className="min-w-0 flex-1 basis-full select-all whitespace-nowrap rounded-lg border-2 border-dashed border-emerald-700 bg-emerald-50 px-3 py-2 text-lg font-bold text-emerald-900"
          >
            {ALIAS}
          </code>
          <button
            type="button"
            onClick={copy}
            className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            {copied ? "¡Copiado!" : "Copiar alias"}
          </button>
        </div>
        <p className="mt-3 text-xs text-neutral-500">A nombre de Francisco Tejada. Cualquier monto ayuda. ¡Gracias!</p>
        <button
          type="button"
          onClick={() => dialog.current?.close()}
          className="mt-4 rounded-lg border border-black/15 px-4 py-2 text-sm font-medium hover:bg-neutral-50"
        >
          Cerrar
        </button>
      </dialog>
    </>
  );
}
