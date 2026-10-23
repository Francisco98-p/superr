import type { NextRequest } from "next/server";
import { normalizeQuery } from "@/lib/query";
import { searchAll } from "@/lib/search";
import { tooManyRequests } from "@/lib/guard";

// Letras (con tildes), números, espacios y algunos signos comunes en nombres de productos.
const VALID_QUERY = /^[\p{L}\p{N} .,'%&\/+-]+$/u;

export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");

  if (query.length < 2 || query.length > 60) {
    return Response.json(
      { error: "La búsqueda debe tener entre 2 y 60 caracteres." },
      { status: 400 },
    );
  }

  if (!VALID_QUERY.test(query)) {
    return Response.json({ error: "La búsqueda tiene caracteres no permitidos." }, { status: 400 });
  }

  // Las búsquedas repetidas salen de la caché de Vercel y no llegan acá; esto limita las nuevas.
  if (tooManyRequests(request, "buscar", 30, 60_000)) {
    return Response.json(
      { error: "Hiciste muchas búsquedas seguidas. Esperá un minuto y volvé a intentar." },
      { status: 429, headers: { "Retry-After": "60", "Cache-Control": "no-store" } },
    );
  }

  const data = await searchAll(query);
  const anyOk = data.stores.some((s) => s.ok);

  return Response.json(data, {
    headers: {
      // Cache each search 1 h on Vercel's CDN (and serve stale up to a day) to avoid hammering the stores.
      "Cache-Control": anyOk
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "no-store",
    },
  });
}
