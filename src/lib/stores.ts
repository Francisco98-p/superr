import cafeAmerica from "../data/cafe-america.json";
import type { Store, StoreId } from "./types";

/** Week the Café América price list is for. */
export const CAFE_AMERICA_VIGENCIA = cafeAmerica.vigencia;

export const STORES: Record<StoreId, Store> = {
  carrefour: {
    id: "carrefour",
    name: "Carrefour",
    color: "#1e4b9c",
    site: "https://www.carrefour.com.ar",
    priceScope: "san-juan",
  },
  changomas: {
    id: "changomas",
    name: "ChangoMás",
    color: "#00873e",
    site: "https://www.masonline.com.ar",
    priceScope: "san-juan",
  },
  laanonima: {
    id: "laanonima",
    name: "La Anónima",
    color: "#0072bc",
    site: "https://www.laanonima.com.ar",
    priceScope: "san-juan",
  },
  vea: {
    id: "vea",
    name: "Vea",
    color: "#d71920",
    site: "https://www.vea.com.ar",
    priceScope: "online",
  },
  atomo: {
    id: "atomo",
    name: "Átomo",
    color: "#e07b00",
    site: "https://atomoconviene.com/atomo-ecommerce",
    priceScope: "online",
  },
  cafeamerica: {
    id: "cafeamerica",
    name: "Café América",
    color: "#7a3b1e",
    site: "",
    priceScope: "lista",
    priceNote: `Lista del súper · ${CAFE_AMERICA_VIGENCIA}`,
  },
  maxiconsumo: {
    id: "maxiconsumo",
    name: "Maxiconsumo",
    color: "#c8102e",
    site: "https://www.maxiconsumo.com/sucursal_san_juan",
    priceScope: "online",
  },
};

/** Supermercados ocultos: no se buscan ni se muestran. Se dejan cargados para poder volver a activarlos. */
export const HIDDEN_STORES: StoreId[] = ["cafeamerica"];

export const isHiddenStore = (id: StoreId) => HIDDEN_STORES.includes(id);

export const STORE_IDS = (Object.keys(STORES) as StoreId[]).filter((id) => !isHiddenStore(id));
