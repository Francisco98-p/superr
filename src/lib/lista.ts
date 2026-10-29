import type { ComparisonGroup, StoreId } from "./types";

/** A product in the shopping list: its barcode and the prices seen when it was added or last refreshed. */
export type ItemLista = {
  ean: string;
  name: string;
  image: string | null;
  /** Search that found it, to refresh its prices later. */
  q: string;
  precios: Partial<Record<StoreId, number>>;
  at: string;
};

export function itemDe(group: ComparisonGroup, q: string): ItemLista {
  return {
    ean: group.ean,
    name: group.name,
    image: group.image,
    q,
    precios: Object.fromEntries(group.offers.map((o) => [o.store, o.price])),
    at: new Date().toISOString(),
  };
}

export type TotalSuper = { store: StoreId; total: number; faltan: string[] };

export type Resultado = {
  /** Supermarkets that have every product, cheapest first. */
  completos: TotalSuper[];
  /** Supermarkets missing some product, with what they're missing. */
  incompletos: TotalSuper[];
  /** Buying each product where it's cheapest. */
  repartido: { total: number; porSuper: { store: StoreId; items: { name: string; precio: number }[]; subtotal: number }[] };
};

export function calcular(items: ItemLista[], stores: StoreId[]): Resultado {
  const totales: TotalSuper[] = stores.map((store) => {
    let total = 0;
    const faltan: string[] = [];
    for (const it of items) {
      const p = it.precios[store];
      if (p === undefined) faltan.push(it.name);
      else total += p;
    }
    return { store, total: Math.round(total * 100) / 100, faltan };
  });
  const conAlgo = totales.filter((t) => t.faltan.length < items.length);
  const completos = conAlgo.filter((t) => t.faltan.length === 0).sort((a, b) => a.total - b.total);
  const incompletos = conAlgo.filter((t) => t.faltan.length > 0).sort((a, b) => a.faltan.length - b.faltan.length || a.total - b.total);

  const grupos = new Map<StoreId, { name: string; precio: number }[]>();
  let total = 0;
  for (const it of items) {
    const mejor = (Object.entries(it.precios) as [StoreId, number][]).sort((a, b) => a[1] - b[1])[0];
    if (!mejor) continue;
    total += mejor[1];
    const g = grupos.get(mejor[0]) ?? [];
    g.push({ name: it.name, precio: mejor[1] });
    grupos.set(mejor[0], g);
  }
  const porSuper = [...grupos.entries()]
    .map(([store, its]) => ({ store, items: its, subtotal: Math.round(its.reduce((a, x) => a + x.precio, 0) * 100) / 100 }))
    .sort((a, b) => b.subtotal - a.subtotal);
  return { completos, incompletos, repartido: { total: Math.round(total * 100) / 100, porSuper } };
}
