// Currency formatting for TND-first (Tunisian Dinar) and any other currency
// the platform may carry later. TND is a **3-decimal-place** currency — the
// smallest unit is the millime (1 TND = 1000 millimes). All amounts are stored
// in the smallest unit in DDB (we kept the legacy `priceCents`/`amountCents`
// field names for backward compatibility, but the value is millimes when
// currency === "TND"). These helpers centralise that conversion so display
// code doesn't have to know which currency uses which decimal convention.

const DECIMAL_PLACES: Record<string, number> = {
  TND: 3,
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  // 2-decimal fallback for EUR, USD, GBP, etc.
};

function placesFor(currency: string): number {
  return DECIMAL_PLACES[currency.toUpperCase()] ?? 2;
}

function trimTrailingZeros(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return parseFloat(value.toPrecision(15)).toString();
}

/**
 * Render an amount stored in the smallest currency unit as a human string.
 * Example: formatMoney(5000, "TND") === "TND 5.000"
 *          formatMoney(500, "EUR")  === "EUR 5.00"
 */
export function formatMoney(
  minorUnits: number | null | undefined,
  currency: string = "TND",
  opts?: { trim?: boolean },
): string {
  const places = placesFor(currency);
  const value = (minorUnits ?? 0) / Math.pow(10, places);
  const num = opts?.trim ? trimTrailingZeros(value) : value.toFixed(places);
  return `${currency.toUpperCase()} ${num}`;
}

/**
 * Render without the currency code — just the number. Useful inside table
 * cells where the currency is already shown in a column header.
 */
export function formatAmount(
  minorUnits: number | null | undefined,
  currency: string = "TND",
  opts?: { trim?: boolean },
): string {
  const places = placesFor(currency);
  const value = (minorUnits ?? 0) / Math.pow(10, places);
  return opts?.trim ? trimTrailingZeros(value) : value.toFixed(places);
}

/**
 * Convert a major-unit input (e.g. a form field typed as "5.25") into the
 * smallest currency unit the API expects. For TND that's millimes; for EUR
 * that's cents. Rounds to avoid floating-point drift from the input.
 */
export function toMinorUnits(majorValue: number, currency: string = "TND"): number {
  const places = placesFor(currency);
  return Math.round(majorValue * Math.pow(10, places));
}

/**
 * Same as formatMoney but renders the currency as a symbol when a well-known
 * one exists. Fallback is the ISO 4217 code so unusual currencies still read.
 */
const SYMBOLS: Record<string, string> = {
  TND: "DT",
  EUR: "€",
  USD: "$",
  GBP: "£",
};

export function formatMoneySymbol(
  minorUnits: number | null | undefined,
  currency: string = "TND",
  opts?: { trim?: boolean },
): string {
  const places = placesFor(currency);
  const value = (minorUnits ?? 0) / Math.pow(10, places);
  const num = opts?.trim ? trimTrailingZeros(value) : value.toFixed(places);
  const sym = SYMBOLS[currency.toUpperCase()] ?? currency.toUpperCase();
  return sym === "DT" ? `${num} DT` : `${sym}${num}`;
}
