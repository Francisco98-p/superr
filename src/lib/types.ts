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

export type Offer = ComparisonGroup & { savingsPct: number };

export type OffersResponse = { fetchedAt: string; offers: Offer[] };

export type SearchResponse = {
  query: string;
  fetchedAt: string;
  stores: StoreResult[];
  comparisons: ComparisonGroup[];
  products: Product[];
};
