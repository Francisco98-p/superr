const COUNTER_API = "https://abacus.jasoncameron.dev";
const NAMESPACE = "precios-super-sanjuan";
// Local and preview deployments must not inflate the public number.
const KEY = process.env.VERCEL_ENV === "production" ? "usuarios" : "usuarios-dev";

async function counter(action: "get" | "hit"): Promise<number | null> {
  try {
    const res = await fetch(`${COUNTER_API}/${action}/${NAMESPACE}/${KEY}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (action === "get" && res.status === 404) return 0;
    if (!res.ok) return null;
    const data = (await res.json()) as { value?: number };
    return typeof data.value === "number" ? data.value : null;
  } catch {
    return null;
  }
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
export async function POST() {
  const value = await counter("hit");
  return Response.json({ value }, { headers: { "Cache-Control": "no-store" } });
}
