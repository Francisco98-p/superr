"use client";

import { useEffect, useRef, useState } from "react";

/** Valida el dígito verificador de EAN-8 / UPC-A / EAN-13 / GTIN-14, así no se busca un código mal leído. */
export function codigoValido(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split("").map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((a, n, i) => a + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

type Estado = { tipo: "abriendo" } | { tipo: "leyendo" } | { tipo: "error"; titulo: string; detalle: string };

type Detector = { detect: (src: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

function Escaner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: "abriendo" });
  // La cámara se abre una sola vez: el callback se lee de una ref para no reiniciarla.
  const cb = useRef(onCode);
  useEffect(() => {
    cb.current = onCode;
  }, [onCode]);

  useEffect(() => {
    let vivo = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let zxingStop: (() => void) | null = null;
    const listo = (code: string) => {
      if (!vivo || !codigoValido(code)) return false;
      vivo = false;
      navigator.vibrate?.(80);
      cb.current(code);
      return true;
    };
    const fallar = (e: unknown) => {
      if (!vivo) return;
      const name = (e as { name?: string })?.name;
      if (name === "NotAllowedError" || name === "SecurityError")
        setEstado({
          tipo: "error",
          titulo: "No diste permiso para usar la cámara",
          detalle: "Tocá el candado 🔒 al lado de la dirección de la página → Permisos → Cámara → Permitir, y volvé a tocar «Escanear».",
        });
      else if (name === "NotFoundError" || name === "OverconstrainedError")
        setEstado({ tipo: "error", titulo: "No encontramos una cámara", detalle: "Probá desde el celular. También podés escribir el código de barras en el buscador." });
      else setEstado({ tipo: "error", titulo: "No se pudo abrir la cámara", detalle: "Cerrá otras apps que la estén usando y volvé a intentar. También podés escribir el código en el buscador." });
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        fallar({ name: "NotFoundError" });
        return;
      }
      const constraints: MediaStreamConstraints = { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false };
      const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      const formatos = BD?.getSupportedFormats ? await BD.getSupportedFormats().catch(() => []) : [];
      try {
        if (BD && formatos.includes("ean_13")) {
          // Detector del navegador (Chrome en Android): más rápido y sin descargar nada.
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!vivo || !video.current) return;
          video.current.srcObject = stream;
          await video.current.play();
          setEstado({ tipo: "leyendo" });
          const det = new BD({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"].filter((f) => formatos.includes(f)) });
          const loop = async () => {
            if (!vivo || !video.current) return;
            try {
              const r = await det.detect(video.current);
              for (const b of r) if (listo(b.rawValue)) return;
            } catch {}
            timer = setTimeout(loop, 180);
          };
          loop();
        } else {
          // iPhone / Safari y otros: ZXing, que se descarga recién al abrir el escáner.
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
          if (!vivo || !video.current) return;
          const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);
          const reader = new BrowserMultiFormatReader(hints);
          const controls = await reader.decodeFromConstraints(constraints, video.current, (res) => {
            if (res && listo(res.getText())) controls.stop();
          });
          zxingStop = () => controls.stop();
          if (!vivo) controls.stop();
          else setEstado({ tipo: "leyendo" });
        }
      } catch (e) {
        fallar(e);
      }
    })();

    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
      zxingStop?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Escanear código de barras">
      <div className="flex items-center justify-between gap-3 p-4">
        <p className="font-semibold">📷 Escaneá el código de barras</p>
        <button type="button" onClick={onClose} className="rounded-lg bg-white/15 px-4 py-2 font-semibold hover:bg-white/25">
          Cerrar
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={video} className="h-full w-full object-cover" muted playsInline autoPlay />
        {estado.tipo !== "error" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-[80%] max-w-md rounded-xl border-4 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        )}
        {estado.tipo === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-sm rounded-xl bg-white p-5 text-neutral-900">
              <p className="font-bold">{estado.titulo}</p>
              <p className="mt-2 text-sm text-neutral-700">{estado.detalle}</p>
              <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white">
                Entendido
              </button>
            </div>
          </div>
        )}
      </div>
      {estado.tipo !== "error" && (
        <p className="p-4 text-center text-sm text-white/80">
          {estado.tipo === "abriendo" ? "Abriendo la cámara..." : "Apuntá al código de barras del producto. Cuando lo lea, te mostramos el precio en cada súper."}
        </p>
      )}
    </div>
  );
}

/** Botón "Escanear" + pantalla de cámara. Al leer un código válido llama a onCode con el número. */
export default function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="shrink-0 rounded-lg border-2 border-emerald-700 bg-white px-3 py-2.5 font-semibold text-emerald-800 transition hover:bg-emerald-50"
        aria-label="Escanear código de barras con la cámara"
      >
        📷 <span className="hidden sm:inline">Escanear</span>
      </button>
      {abierto && (
        <Escaner
          onClose={() => setAbierto(false)}
          onCode={(code) => {
            setAbierto(false);
            onCode(code);
          }}
        />
      )}
    </>
  );
}
