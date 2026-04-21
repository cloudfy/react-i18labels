// ─── React runtime ────────────────────────────────────────────────────────────
export { I18nProvider, useTranslation, T } from "./react.js";
// ─── Locale detection ─────────────────────────────────────────────────────────
export { detectLocale, persistLocale, clearPersistedLocale, matchLocale } from "./detect.js";
// ─── Formatting ───────────────────────────────────────────────────────────────
export { formatNumber, formatCurrency, formatPercent, formatDate, formatRelative, formatRelativeAuto, formatList, } from "./format.js";
// ─── Plural resolution ────────────────────────────────────────────────────────
export { pluralFn, ordinalFn } from "./plural.js";
// ─── Build-time compiler ──────────────────────────────────────────────────────
export { parseICU, isComplex, collectArgs } from "./icu-parser.js";
export { compileMessage, compileLocale } from "./icu-codegen.js";
//# sourceMappingURL=index.js.map