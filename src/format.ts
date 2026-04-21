/**
 * Intl formatting utilities
 *
 * Thin, zero-dependency wrappers around the browser's native Intl APIs.
 * These add no meaningful bundle weight — Intl is built into every modern
 * JS engine.  All formatters are cached per locale + options fingerprint so
 * repeated calls (e.g. inside a list render) are O(1).
 *
 * Usage via the hook:
 *
 *   const { formatNumber, formatDate, formatList, formatRelative } = useTranslation();
 *
 *   formatNumber(12345.6)                              // "12,345.6"  (en)  /  "12.345,6"  (de)
 *   formatNumber(9.99, { style: "currency", currency: "EUR" })   // "€9.99"
 *   formatNumber(0.42, { style: "percent" })           // "42%"
 *
 *   formatDate(new Date(), "short")                    // "4/21/26"  (en)
 *   formatDate(new Date(), "long")                     // "April 21, 2026"
 *   formatDate(new Date(), { dateStyle:"medium", timeStyle:"short" })  // "Apr 21, 2026, 2:30 PM"
 *
 *   formatRelative(-1, "day")                          // "yesterday"   (uses Intl.RelativeTimeFormat)
 *   formatRelative(3, "month")                         // "in 3 months"
 *
 *   formatList(["apples","bananas","oranges"])          // "apples, bananas, and oranges"
 */

// ─── Cache helpers ────────────────────────────────────────────────────────────

const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();
const relativeCache = new Map<string, Intl.RelativeTimeFormat>();
const listCache = new Map<string, Intl.ListFormat>();

function cacheKey(locale: string, opts: object): string {
  return locale + JSON.stringify(opts);
}

// ─── Number formatting ────────────────────────────────────────────────────────

export type NumberStyle = "decimal" | "currency" | "percent" | "unit";

export interface FormatNumberOptions extends Intl.NumberFormatOptions {
  // Re-exported for convenience so callers import from one place
}

/**
 * Format a number according to the active locale.
 *
 * @example
 *   formatNumber(1234567.89, "de", { style: "currency", currency: "EUR" })
 *   // → "1.234.567,89 €"
 */
export function formatNumber(
  value: number,
  locale: string,
  options: FormatNumberOptions = {},
): string {
  const key = cacheKey(locale, options);
  let fmt = numberFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, fmt);
  }
  return fmt.format(value);
}

// Convenience shorthands exposed on the hook

export function formatCurrency(
  value: number,
  currency: string,
  locale: string,
  options: Omit<FormatNumberOptions, "style" | "currency"> = {},
): string {
  return formatNumber(value, locale, { style: "currency", currency, ...options });
}

export function formatPercent(
  value: number,
  locale: string,
  options: Omit<FormatNumberOptions, "style"> = {},
): string {
  return formatNumber(value, locale, { style: "percent", ...options });
}

// ─── Date / time formatting ───────────────────────────────────────────────────

/** Named presets map to Intl.DateTimeFormatOptions for convenience. */
const DATE_PRESETS: Record<string, Intl.DateTimeFormatOptions> = {
  short:    { dateStyle: "short" },
  medium:   { dateStyle: "medium" },
  long:     { dateStyle: "long" },
  full:     { dateStyle: "full" },
  time:     { timeStyle: "short" },
  datetime: { dateStyle: "medium", timeStyle: "short" },
};

export type DatePreset = keyof typeof DATE_PRESETS;

/**
 * Format a Date (or timestamp) according to the active locale.
 *
 * @param value   A Date object, ISO string, or Unix ms timestamp
 * @param locale  Active locale
 * @param format  A preset name or raw Intl.DateTimeFormatOptions
 *
 * @example
 *   formatDate(new Date(), "da", "long")   // "21. april 2026"
 *   formatDate(new Date(), "en", "short")  // "4/21/26"
 */
export function formatDate(
  value: Date | string | number,
  locale: string,
  format: DatePreset | Intl.DateTimeFormatOptions = "medium",
): string {
  const date = value instanceof Date ? value : new Date(value);
  const opts: Intl.DateTimeFormatOptions =
    typeof format === "string" ? (DATE_PRESETS[format] ?? DATE_PRESETS.medium) : format;

  const key = cacheKey(locale, opts);
  let fmt = dateFormatCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    dateFormatCache.set(key, fmt);
  }
  return fmt.format(date);
}

// ─── Relative time ────────────────────────────────────────────────────────────

export type RelativeUnit =
  | "year" | "quarter" | "month" | "week"
  | "day"  | "hour"    | "minute" | "second";

/**
 * Format a relative time offset.
 *
 * @param value  Positive = future, negative = past
 * @param unit   Time unit
 * @param locale Active locale
 * @param style  "long" (default) | "short" | "narrow"
 *
 * @example
 *   formatRelative(-1, "day",  "en")  // "yesterday"
 *   formatRelative(3,  "week", "da")  // "om 3 uger"
 */
export function formatRelative(
  value: number,
  unit: RelativeUnit,
  locale: string,
  style: Intl.RelativeTimeFormatStyle = "long",
): string {
  const key = cacheKey(locale, { style });
  let fmt = relativeCache.get(key);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style });
    relativeCache.set(key, fmt);
  }
  return fmt.format(value, unit);
}

/**
 * Convenience: compute a human relative time from a Date automatically.
 * Chooses the most appropriate unit (days if < 30 days, months otherwise, etc.)
 */
export function formatRelativeAuto(
  date: Date | string | number,
  locale: string,
  style: Intl.RelativeTimeFormatStyle = "long",
): string {
  const ms = (date instanceof Date ? date : new Date(date)).getTime() - Date.now();
  const abs = Math.abs(ms);

  let value: number;
  let unit: RelativeUnit;

  if (abs < 60_000)         { value = Math.round(ms / 1_000);     unit = "second"; }
  else if (abs < 3_600_000) { value = Math.round(ms / 60_000);    unit = "minute"; }
  else if (abs < 86_400_000){ value = Math.round(ms / 3_600_000); unit = "hour";   }
  else if (abs < 2_592_000_000) { value = Math.round(ms / 86_400_000); unit = "day"; }
  else if (abs < 31_536_000_000){ value = Math.round(ms / 2_592_000_000); unit = "month"; }
  else                      { value = Math.round(ms / 31_536_000_000); unit = "year"; }

  return formatRelative(value, unit, locale, style);
}

// ─── List formatting ──────────────────────────────────────────────────────────

export type ListStyle = "conjunction" | "disjunction" | "unit";

/**
 * Format an array of strings as a locale-aware list.
 *
 * @example
 *   formatList(["apples","pears","oranges"], "en") // "apples, pears, and oranges"
 *   formatList(["apples","pears","oranges"], "da") // "æbler, pærer og appelsiner"
 */
export function formatList(
  items: string[],
  locale: string,
  style: ListStyle = "conjunction",
  width: Intl.ListFormatStyle = "long",
): string {
  const key = cacheKey(locale, { style, width });
  let fmt = listCache.get(key);
  if (!fmt) {
    fmt = new Intl.ListFormat(locale, { type: style, style: width });
    listCache.set(key, fmt);
  }
  return fmt.format(items);
}
