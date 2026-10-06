import type { NextRequest } from "next/server";
import { normalizeQuery } from "@/lib/query";
import { searchAll } from "@/lib/search";

export const maxDuration = 20;

export async function GET(request: NextRequest) {
  const query = normalizeQuery(request.nextUrl.searchParams.get("q") ?? "");

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
      // Cache each search 1 h on Vercel's CDN (and serve stale up to a day) to avoid hammering the stores.
      "Cache-Control": anyOk
        ? "public, s-maxage=3600, stale-while-revalidate=86400"
        : "no-store",
    },
  });
}
