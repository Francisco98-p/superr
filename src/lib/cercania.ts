import sucursales from "../data/sucursales.json";
import type { StoreId } from "./types";

export type Sucursal = { store: StoreId; nombre: string; direccion: string; lat: number; lon: number };
export type Cercana = Sucursal & { km: number };

const SUCURSALES = sucursales.sucursales as Sucursal[];

/** Distance in a straight line, in km (haversine). */
export function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/** The closest branch of each supermarket, closest first. */
export function masCercanas(lat: number, lon: number): Cercana[] {
  const porSuper = new Map<StoreId, Cercana>();
  for (const s of SUCURSALES) {
    const km = distanciaKm(lat, lon, s.lat, s.lon);
    const prev = porSuper.get(s.store);
    if (!prev || km < prev.km) porSuper.set(s.store, { ...s, km });
  }
  return [...porSuper.values()].sort((a, b) => a.km - b.km);
}

export function formatKm(km: number): string {
  return km < 1 ? `${Math.round(km * 100) * 10} m` : `${km.toFixed(1).replace(".", ",")} km`;
}

/** Google Maps directions from wherever the phone is to the branch. */
export function comoLlegar(s: Sucursal): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;
}
