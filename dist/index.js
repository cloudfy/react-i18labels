// ─── React runtime ────────────────────────────────────────────────────────────
export { I18nProvider, useTranslation, T } from "./react";
// ─── Locale detection ─────────────────────────────────────────────────────────
export { detectLocale, persistLocale, clearPersistedLocale, matchLocale } from "./detect";
// ─── Formatting ───────────────────────────────────────────────────────────────
export { formatNumber, formatCurrency, formatPercent, formatDate, formatRelative, formatRelativeAuto, formatList, } from "./format";
// ─── Plural resolution ────────────────────────────────────────────────────────
export { pluralFn, ordinalFn } from "./plural";
// ─── Build-time compiler ──────────────────────────────────────────────────────
export { parseICU, isComplex, collectArgs } from "./icu-parser";
export { compileMessage, compileLocale } from "./icu-codegen";
//# sourceMappingURL=index.js.map