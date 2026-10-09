export type StoreId = "carrefour" | "changomas" | "laanonima" | "vea" | "atomo";

export type Store = {
  id: StoreId;
  name: string;
  color: string;
  site: string;
  priceScope: "san-juan" | "online";
};

export type Product = {
  store: StoreId;
  name: string;
  brand: string | null;
  ean: string | null;
  price: number;
  regularPrice: number | null;
  unitPrice: number | null;
  unitLabel: "kg" | "L" | null;
  image: string | null;
  url: string;
  /** When this store answered (ISO). */
  fetchedAt: string;
};

export type StoreResult = {
  store: StoreId;
  ok: boolean;
  count: number;
  error?: string;
};

export type ComparisonGroup = {
  ean: string;
  name: string;
  image: string | null;
  offers: Product[];
  cheapest: StoreId;
  savings: number;
};

/** Listings that share a barcode but are not the same presentation, left out of the comparison. */
export type DiscardedGroup = {
  ean: string;
  kept: { store: StoreId; name: string }[];
  dropped: { store: StoreId; name: string; price: number; reason: string }[];
};

export type Offer = ComparisonGroup & {
  savingsPct: number;
  /** Gap big enough that the price should be checked at the store. */
  verify: boolean;
};

export type ExcludedOffer = { ean: string; name: string; savingsPct: number; reason: string; offers: { store: StoreId; name: string; price: number }[] };

export type OffersResponse = { fetchedAt: string; offers: Offer[]; excluded?: ExcludedOffer[] };

export type SearchResponse = {
  query: string;
  fetchedAt: string;
  stores: StoreResult[];
  comparisons: ComparisonGroup[];
  discarded: DiscardedGroup[];
  products: Product[];
};
