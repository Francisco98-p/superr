import type { NextRequest } from "next/server";

/** Pedidos que vienen del propio sitio (producción, vistas previas o desarrollo local). */
export function fromOwnSite(request: NextRequest | Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return host === "precios-super-sanjuan.vercel.app" || (host.endsWith(".vercel.app") && host.startsWith("precios-super-sanjuan")) || host === "localhost";
  } catch {
    return false;
  }
}

function clientIp(request: NextRequest | Request): string {
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
}

// Límite simple por conexión (IP) dentro de cada instancia del servidor: frena a quien manda
// muchas búsquedas inventadas para saltear la caché y saturar a los supermercados.
const hits = new Map<string, { n: number; reset: number }>();

export function tooManyRequests(request: NextRequest | Request, bucket: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const ip = bucket + ":" + clientIp(request);
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    if (hits.size > 5000) hits.clear();
    hits.set(ip, { n: 1, reset: now + windowMs });
    return false;
  }
  entry.n += 1;
  return entry.n > max;
}
