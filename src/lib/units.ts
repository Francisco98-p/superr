const QTY_RE =
  /(\d+(?:[.,]\d+)?)\s*(kgs?|kilos?|grs?|gramos|g|litros?|lts?|lt|l|ml|cc|cm3)(?![a-z])/gi;

/** Price per kg or per litre, parsed from the product name ("Yerba 500 gr"). */
export function unitPriceFromName(
  name: string,
  price: number,
): { unitPrice: number; unitLabel: "kg" | "L" } | null {
  const matches = [...name.toLowerCase().matchAll(QTY_RE)];
  const last = matches.at(-1);
  if (!last) return null;

  const qty = Number(last[1].replace(",", "."));
  if (!qty) return null;

  const unit = last[2];
  let amount: number;
  let label: "kg" | "L";

  if (/^(kgs?|kilos?)$/.test(unit)) {
    amount = qty;
    label = "kg";
  } else if (/^(grs?|gramos|g)$/.test(unit)) {
    amount = qty / 1000;
    label = "kg";
  } else if (/^(ml|cc|cm3)$/.test(unit)) {
    amount = qty / 1000;
    label = "L";
  } else {
    amount = qty;
    label = "L";
  }

  if (amount <= 0) return null;
  return { unitPrice: Math.round(price / amount), unitLabel: label };
}
