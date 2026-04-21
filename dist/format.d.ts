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
export type NumberStyle = "decimal" | "currency" | "percent" | "unit";
export interface FormatNumberOptions extends Intl.NumberFormatOptions {
}
/**
 * Format a number according to the active locale.
 *
 * @example
 *   formatNumber(1234567.89, "de", { style: "currency", currency: "EUR" })
 *   // → "1.234.567,89 €"
 */
export declare function formatNumber(value: number, locale: string, options?: FormatNumberOptions): string;
export declare function formatCurrency(value: number, currency: string, locale: string, options?: Omit<FormatNumberOptions, "style" | "currency">): string;
export declare function formatPercent(value: number, locale: string, options?: Omit<FormatNumberOptions, "style">): string;
/** Named presets map to Intl.DateTimeFormatOptions for convenience. */
declare const DATE_PRESETS: Record<string, Intl.DateTimeFormatOptions>;
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
export declare function formatDate(value: Date | string | number, locale: string, format?: DatePreset | Intl.DateTimeFormatOptions): string;
export type RelativeUnit = "year" | "quarter" | "month" | "week" | "day" | "hour" | "minute" | "second";
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
export declare function formatRelative(value: number, unit: RelativeUnit, locale: string, style?: Intl.RelativeTimeFormatStyle): string;
/**
 * Convenience: compute a human relative time from a Date automatically.
 * Chooses the most appropriate unit (days if < 30 days, months otherwise, etc.)
 */
export declare function formatRelativeAuto(date: Date | string | number, locale: string, style?: Intl.RelativeTimeFormatStyle): string;
export type ListStyle = "conjunction" | "disjunction" | "unit";
/**
 * Format an array of strings as a locale-aware list.
 *
 * @example
 *   formatList(["apples","pears","oranges"], "en") // "apples, pears, and oranges"
 *   formatList(["apples","pears","oranges"], "da") // "æbler, pærer og appelsiner"
 */
export declare function formatList(items: string[], locale: string, style?: ListStyle, width?: Intl.ListFormatStyle): string;
export {};
//# sourceMappingURL=format.d.ts.map