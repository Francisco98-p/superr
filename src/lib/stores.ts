import type { Store, StoreId } from "./types";

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
};

export const STORE_IDS = Object.keys(STORES) as StoreId[];
