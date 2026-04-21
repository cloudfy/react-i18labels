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
const numberFormatCache = new Map();
const dateFormatCache = new Map();
const relativeCache = new Map();
const listCache = new Map();
function cacheKey(locale, opts) {
    return locale + JSON.stringify(opts);
}
/**
 * Format a number according to the active locale.
 *
 * @example
 *   formatNumber(1234567.89, "de", { style: "currency", currency: "EUR" })
 *   // → "1.234.567,89 €"
 */
export function formatNumber(value, locale, options = {}) {
    const key = cacheKey(locale, options);
    let fmt = numberFormatCache.get(key);
    if (!fmt) {
        fmt = new Intl.NumberFormat(locale, options);
        numberFormatCache.set(key, fmt);
    }
    return fmt.format(value);
}
// Convenience shorthands exposed on the hook
export function formatCurrency(value, currency, locale, options = {}) {
    return formatNumber(value, locale, { style: "currency", currency, ...options });
}
export function formatPercent(value, locale, options = {}) {
    return formatNumber(value, locale, { style: "percent", ...options });
}
// ─── Date / time formatting ───────────────────────────────────────────────────
/** Named presets map to Intl.DateTimeFormatOptions for convenience. */
const DATE_PRESETS = {
    short: { dateStyle: "short" },
    medium: { dateStyle: "medium" },
    long: { dateStyle: "long" },
    full: { dateStyle: "full" },
    time: { timeStyle: "short" },
    datetime: { dateStyle: "medium", timeStyle: "short" },
};
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
export function formatDate(value, locale, format = "medium") {
    const date = value instanceof Date ? value : new Date(value);
    const opts = typeof format === "string" ? (DATE_PRESETS[format] ?? DATE_PRESETS.medium) : format;
    const key = cacheKey(locale, opts);
    let fmt = dateFormatCache.get(key);
    if (!fmt) {
        fmt = new Intl.DateTimeFormat(locale, opts);
        dateFormatCache.set(key, fmt);
    }
    return fmt.format(date);
}
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
export function formatRelative(value, unit, locale, style = "long") {
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
export function formatRelativeAuto(date, locale, style = "long") {
    const ms = (date instanceof Date ? date : new Date(date)).getTime() - Date.now();
    const abs = Math.abs(ms);
    let value;
    let unit;
    if (abs < 60000) {
        value = Math.round(ms / 1000);
        unit = "second";
    }
    else if (abs < 3600000) {
        value = Math.round(ms / 60000);
        unit = "minute";
    }
    else if (abs < 86400000) {
        value = Math.round(ms / 3600000);
        unit = "hour";
    }
    else if (abs < 2592000000) {
        value = Math.round(ms / 86400000);
        unit = "day";
    }
    else if (abs < 31536000000) {
        value = Math.round(ms / 2592000000);
        unit = "month";
    }
    else {
        value = Math.round(ms / 31536000000);
        unit = "year";
    }
    return formatRelative(value, unit, locale, style);
}
/**
 * Format an array of strings as a locale-aware list.
 *
 * @example
 *   formatList(["apples","pears","oranges"], "en") // "apples, pears, and oranges"
 *   formatList(["apples","pears","oranges"], "da") // "æbler, pærer og appelsiner"
 */
export function formatList(items, locale, style = "conjunction", width = "long") {
    const key = cacheKey(locale, { style, width });
    let fmt = listCache.get(key);
    if (!fmt) {
        fmt = new Intl.ListFormat(locale, { type: style, style: width });
        listCache.set(key, fmt);
    }
    return fmt.format(items);
}
//# sourceMappingURL=format.js.map