/** Size, pack count and other numbers read from a product name, to check two listings are the same presentation. */
export type Presentation = {
  /** Grams or millilitres (the last size in the name). */
  amount: { value: number; kind: "g" | "ml" } | null;
  /** Every size the name can mean in total: each size, and each size times the pack count ("3 x 100 g" = 300 g). */
  totals: number[];
  units: number | null;
  /** Remaining numbers in the name, e.g. "3" in "Sopa 3 vegetales" or "1.5" in "Leche 1,5%". */
  other: string[];
};

const MEASURE_RE =
  /(\d+(?:\.\d+)?)\s*(kgs?|kilos?|kilogramos?|grs?|gramos?|g|litros?|lts?|lt|l|ml|cc|cm3)(?![a-z])/g;
const UNITS_RE = [
  /(\d+)\s*(?:u|un|uni|unid|unidad|unidades|uds|sobres?|saquitos?|rollos?|paquetes?)(?![a-z])/g,
  /\bpack\s*(?:x\s*)?(\d+)/g,
  /\bx\s*(\d+)(?!\s*(?:\.\d|kg|kilo|g|gr|gramo|l|lt|litro|ml|cc|cm3))(?![\d.])/g,
  /(\d+)\s*x\s*(?=\d)/g,
];

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    // "4/0" is how some stores write flour "0000"; "N°28" / "N 28" is a pasta or model number.
    .replace(/\b(\d)\/0\b/g, (_, n) => "0".repeat(Number(n)))
    .replace(/\bn\s*[°º]?\s*(?=\d)/g, " ")
    .replace(/(\d)\.(\d{3})(?!\d)/g, "$1$2");
}

export function parsePresentation(name: string): Presentation {
  let text = normalize(name);

  let amount: Presentation["amount"] = null;
  const amounts: number[] = [];
  for (const m of text.matchAll(MEASURE_RE)) {
    const qty = Number(m[1]);
    if (!qty) continue;
    const unit = m[2];
    if (/^(kgs?|kilos?|kilogramos?)$/.test(unit)) amount = { value: qty * 1000, kind: "g" };
    else if (/^(grs?|gramos?|g)$/.test(unit)) amount = { value: qty, kind: "g" };
    else if (/^(ml|cc|cm3)$/.test(unit)) amount = { value: qty, kind: "ml" };
    else amount = { value: qty * 1000, kind: "ml" };
    amounts.push(amount.value);
  }
  text = text.replace(MEASURE_RE, " ");

  let units: number | null = null;
  for (const re of UNITS_RE) {
    for (const m of text.matchAll(re)) {
      const n = Number(m[1]);
      if (n > 1) units = n;
    }
    text = text.replace(re, " ");
  }

  const other = [...text.matchAll(/(?<![a-z\d.])(\d+(?:\.\d+)?)/g)].map((m) => String(Number(m[1])));
  const totals = units ? [...amounts, ...amounts.map((a) => a * units!)] : amounts;
  return { amount, totals, units, other: [...new Set(other)].sort() };
}

const fmtAmount = (a: NonNullable<Presentation["amount"]>) =>
  a.kind === "g"
    ? a.value >= 1000 ? `${a.value / 1000} kg` : `${a.value} g`
    : a.value >= 1000 ? `${a.value / 1000} L` : `${a.value} ml`;

/** Null when both names can be the same presentation; otherwise why they can't. */
export function presentationMismatch(a: Presentation, b: Presentation): string | null {
  if (a.amount && b.amount && a.amount.kind === b.amount.kind) {
    const close = (x: number, y: number) => Math.abs(x - y) / Math.max(x, y) <= 0.02;
    if (!a.totals.some((x) => b.totals.some((y) => close(x, y)))) {
      const what = a.amount.kind === "g" ? "Gramaje" : "Volumen";
      return `${what} distinto: ${fmtAmount(a.amount)} vs ${fmtAmount(b.amount)}`;
    }
  }
  if (a.units && b.units && a.units !== b.units) return `Cantidad distinta: ${a.units} un vs ${b.units} un`;
  if (a.other.length && b.other.length && a.other.join() !== b.other.join()) {
    return `Números distintos en el nombre: ${a.other.join(", ")} vs ${b.other.join(", ")}`;
  }
  return null;
}

const NAME_STOP = new Set([
  "de", "la", "el", "los", "las", "y", "en", "con", "para", "por", "un", "una", "del", "al", "a", "o",
]);
/** Words one store often writes and another omits for the same SKU; ignored when there is no barcode. */
const NAME_FILLERS = new Set([
  "molido",
  "molida",
  "instantaneo",
  "instantanea",
  "torrado",
  "torrada",
  "clasico",
  "clasica",
  "tradicional",
  "original",
  "premium",
  "nuevo",
  "nueva",
  "pack",
  "oferta",
  "suave",
  "mate", // "yerba" / "yerba mate"
  "hierbas", // usually goes with "compuesta"
  "azucar", // many titles omit "con azúcar" on the default SKU
  "palo", // "con palo" omitted on short names
]);

/** If only one title has these, it is a different variety (not just a shorter catalog name). */
const NAME_VARIANTS = new Set([
  "compuesta",
  "despalada",
  "descremada",
  "descremado",
  "entera",
  "entero",
  "light",
  "zero",
  "mezcla",
  "girasol",
  "oliva",
  "soja",
  "vegetal",
  "almendra",
  "almendras",
  "avena",
  "coco",
  "chocolate",
  "vainilla",
  "limon",
  "naranja",
  "menta",
  "boldo",
  "integral",
  "descafeinado",
  "descafeinada",
  "bebe",
  "infantil",
  "sin", // "sin azúcar", "sin palo", etc.
]);

function nameTokens(name: string): Set<string> {
  const text = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[^a-z0-9\s]/g, " ");
  // Drop sizes/units: matching already checks presentation separately.
  MEASURE_RE.lastIndex = 0;
  const withoutMeasures = text.replace(MEASURE_RE, " ").replace(/\b\d+(?:\.\d+)?\b/g, " ");
  return new Set(
    withoutMeasures
      .split(/\s+/)
      .filter((t) => t.length > 1 && !NAME_STOP.has(t)),
  );
}

/**
 * Whether two product titles look like the same item when there is no barcode
 * (e.g. Maxiconsumo’s shorter names). Presentation must still be checked separately.
 */
export function productNamesMatch(a: string, b: string): boolean {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (!ta.size || !tb.size) return false;

  const core = (tokens: Set<string>) => [...tokens].filter((t) => !NAME_FILLERS.has(t));
  const [smaller, larger] = core(ta).length <= core(tb).length ? [ta, tb] : [tb, ta];
  const smallCore = core(smaller);
  if (smallCore.length < 2) return false;
  if (!smallCore.every((t) => larger.has(t))) return false;

  // Longer title may add generic words ("palo", "suave"), but not another variety.
  const extras = core(larger).filter((t) => !smaller.has(t));
  return !extras.some((t) => NAME_VARIANTS.has(t));
}
