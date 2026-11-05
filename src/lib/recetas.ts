import { unstable_cache } from "next/cache";
import data from "../data/recetas.json";
import { searchAll } from "./search";
import type { ComparisonGroup } from "./types";

type IngredienteDef = { nombre: string; q: string; must: string[]; not?: string[]; kg?: number; L?: number; paq?: number };
type RecetaDef = { id: string; nombre: string; porciones: number; pasos: string; ingredientes: IngredienteDef[]; frescos: string[] };

export type IngredienteCosto = {
  nombre: string;
  /** Producto elegido (el de menor precio por kg / L, o el paquete más barato), con sus precios por súper. */
  group: ComparisonGroup | null;
  /** Lo que cuesta la cantidad que lleva la receta, comprándolo donde es más barato. */
  costo: number | null;
};

export type RecetaDelDia = {
  id: string;
  nombre: string;
  porciones: number;
  pasos: string;
  frescos: string[];
  ingredientes: IngredienteCosto[];
  total: number;
  porPorcion: number;
  fecha: string;
  fetchedAt: string;
};

const RECETAS = (data.recetas as RecetaDef[]).filter((r) => r.ingredientes.length);

const fold = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ñ/g, "n");

/** Día en San Juan (UTC−3), para que la receta cambie a la medianoche de acá. */
export function hoyEnSanJuan(now = new Date()): string {
  return new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

/** Una receta por día, rotando la lista. */
export function recetaDelDia(fecha: string): RecetaDef {
  const dias = Math.floor(Date.parse(fecha + "T12:00:00Z") / 86400_000);
  return RECETAS[((dias % RECETAS.length) + RECETAS.length) % RECETAS.length];
}

async function costear(ing: IngredienteDef): Promise<IngredienteCosto> {
  const res = await searchAll(ing.q);
  const must = ing.must.map(fold), no = (ing.not ?? []).map(fold);
  // Tiene que nombrar el ingrediente y no ser otra cosa (ej. "atún" de alimento para gato, "pan de hamburguesa").
  const candidatos = res.comparisons.filter((g) => {
    const n = fold(g.name);
    return must.every((w) => n.includes(w)) && !no.some((w) => n.includes(w));
  });
  if (ing.paq !== undefined) {
    // Paquete: el más barato; se cobra la fracción que se usa.
    const g = candidatos.slice().sort((a, b) => a.offers[0].price - b.offers[0].price)[0] ?? null;
    return { nombre: ing.nombre, group: g, costo: g ? Math.round(g.offers[0].price * ing.paq) : null };
  }
  const label = ing.kg !== undefined ? "kg" : "L";
  const cantidad = (ing.kg ?? ing.L) as number;
  // Por kg / L: el producto con el menor precio por unidad (en el súper donde es más barato).
  let best: { g: ComparisonGroup; unit: number } | null = null;
  for (const g of candidatos) {
    const unit = Math.min(
      ...g.offers.filter((o) => o.unitLabel === label && o.unitPrice).map((o) => o.unitPrice as number),
    );
    if (Number.isFinite(unit) && (!best || unit < best.unit)) best = { g, unit };
  }
  return { nombre: ing.nombre, group: best?.g ?? null, costo: best ? Math.round(best.unit * cantidad) : null };
}

export async function armar(fecha: string): Promise<RecetaDelDia> {
  const r = recetaDelDia(fecha);
  const ingredientes: IngredienteCosto[] = [];
  // De a dos búsquedas, para no saturar a los supermercados.
  for (let i = 0; i < r.ingredientes.length; i += 2) {
    ingredientes.push(...(await Promise.all(r.ingredientes.slice(i, i + 2).map(costear))));
  }
  const conPrecio = ingredientes.filter((x) => x.costo !== null);
  // Si faltan muchos precios (súper caídos), no se guarda y se reintenta en la próxima visita.
  if (conPrecio.length < Math.ceil(ingredientes.length * 0.6)) throw new Error("Pocos precios para la receta");
  const total = conPrecio.reduce((a, x) => a + (x.costo as number), 0);
  return {
    id: r.id,
    nombre: r.nombre,
    porciones: r.porciones,
    pasos: r.pasos,
    frescos: r.frescos,
    ingredientes,
    total,
    porPorcion: Math.round(total / r.porciones),
    fecha,
    fetchedAt: new Date().toISOString(),
  };
}

/** Receta de hoy con su costo, guardada todo el día (se arma con la primera visita). */
export async function getCachedRecetaDelDia(): Promise<RecetaDelDia | null> {
  const fecha = hoyEnSanJuan();
  try {
    return await unstable_cache(() => armar(fecha), ["receta-del-dia-v1", fecha], { revalidate: 12 * 60 * 60 })();
  } catch {
    return null;
  }
}
