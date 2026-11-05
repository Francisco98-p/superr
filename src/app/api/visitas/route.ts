import { fromOwnSite, tooManyRequests } from "@/lib/guard";

const COUNTER_API = "https://abacus.jasoncameron.dev";
const NAMESPACE = "precios-super-sanjuan";
// Local and preview deployments must not inflate the public number.
const KEY = process.env.VERCEL_ENV === "production" ? "usuarios" : "usuarios-dev";

// Último número conocido en esta instancia, por si el contador externo no responde un rato.
let lastKnown: number | null = null;

async function call(path: string): Promise<{ status: number; value: number | null }> {
  try {
    const res = await fetch(`${COUNTER_API}/${path}/${NAMESPACE}/${KEY}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { status: res.status, value: null };
    const data = (await res.json()) as { value?: number };
    return { status: res.status, value: typeof data.value === "number" ? data.value : null };
  } catch {
    return { status: 0, value: null };
  }
}

let lastHitOk = false;

async function counter(action: "get" | "hit"): Promise<number | null> {
  let r = await call(action);
  lastHitOk = action === "hit" && r.value !== null;
  if (action === "get" && r.status === 404) return 0;
  // Si "get" o "hit" fallan, "info" suele seguir andando: devuelve el número sin sumar.
  if (r.value === null) r = await call("info");
  if (r.value !== null) lastKnown = r.value;
  return r.value ?? lastKnown;
}

/** Current number of unique users. */
export async function GET() {
  const value = await counter("get");
  return Response.json(
    { value },
    { headers: { "Cache-Control": value === null ? "no-store" : "public, s-maxage=60" } },
  );
}

/** Called once per browser, the first time someone opens the site. */
export async function POST(request: Request) {
  // Solo suma desde el propio sitio y, como mucho, una vez por conexión cada hora.
  const value = fromOwnSite(request) && !tooManyRequests(request, "visitas", 1, 3_600_000) ? await counter("hit") : await counter("get");
  // counted: false si no se pudo sumar, así el navegador lo vuelve a intentar la próxima vez.
  return Response.json({ value, counted: lastHitOk }, { headers: { "Cache-Control": "no-store" } });
}
