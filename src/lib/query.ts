/** Same text for "Leche  La Serenisima" and "leche la serenisima", so the CDN cache is shared. */
export function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}
