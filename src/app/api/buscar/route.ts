import type { NextRequest } from "next/server";
import { searchAll } from "@/lib/search";

export const maxDuration = 20;
// São Paulo: closest Vercel region to the Argentine store servers.
export const preferredRegion = "gru1";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  if (query.length < 2 || query.length > 60) {
    return Response.json(
      { error: "La búsqueda debe tener entre 2 y 60 caracteres." },
      { status: 400 },
    );
  }

  const data = await searchAll(query);
  const anyOk = data.stores.some((s) => s.ok);

  return Response.json(data, {
    headers: {
      // Cache each search 30 min on Vercel's CDN to avoid hammering the stores.
      "Cache-Control": anyOk
        ? "public, s-maxage=1800, stale-while-revalidate=3600"
        : "no-store",
    },
  });
}
