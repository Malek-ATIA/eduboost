// Server-side mirror of web/src/lib/money.ts. Centralises the decimal-places
// lookup so backend code (notification emails, invoice PDFs, logs) renders
// money in a currency-correct form. TND is a 3-decimal currency (1 TND = 1000
// millimes), Stripe's smallest-currency-unit convention.

const DECIMAL_PLACES: Record<string, number> = {
  TND: 3,
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
};

function placesFor(currency: string): number {
  return DECIMAL_PLACES[currency.toUpperCase()] ?? 2;
}

/** "TND 5.000" or "EUR 5.00" — used in email bodies and invoice PDFs. */
export function formatMoney(
  minorUnits: number | null | undefined,
  currency: string = "TND",
): string {
  const places = placesFor(currency);
  const value = (minorUnits ?? 0) / Math.pow(10, places);
  return `${currency.toUpperCase()} ${value.toFixed(places)}`;
}

/** "5.000 DT" or "€5.00" — used when the surface prefers a symbol. */
const SYMBOLS: Record<string, string> = {
  TND: "DT",
  EUR: "€",
  USD: "$",
  GBP: "£",
};

export function formatMoneySymbol(
  minorUnits: number | null | undefined,
  currency: string = "TND",
): string {
  const places = placesFor(currency);
  const value = (minorUnits ?? 0) / Math.pow(10, places);
  const sym = SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
  return sym === "DT" ? `${value.toFixed(places)} DT` : `${sym}${value.toFixed(places)}`;
}
