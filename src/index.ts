// ─── React runtime ────────────────────────────────────────────────────────────
export { I18nProvider, useTranslation, T } from "./react.js";
export type { I18nProviderProps, I18nConfig, LocaleLoader, TProps } from "./react.js";

// ─── Locale detection ─────────────────────────────────────────────────────────
export { detectLocale, persistLocale, clearPersistedLocale, matchLocale } from "./detect.js";
export type { DetectLocaleOptions } from "./detect.js";

// ─── Formatting ───────────────────────────────────────────────────────────────
export {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatRelative,
  formatRelativeAuto,
  formatList,
} from "./format.js";
export type { DatePreset, FormatNumberOptions, ListStyle, RelativeUnit } from "./format.js";

// ─── Plural resolution ────────────────────────────────────────────────────────
export { pluralFn, ordinalFn } from "./plural.js";

// ─── Build-time compiler ──────────────────────────────────────────────────────
export { parseICU, isComplex, collectArgs } from "./icu-parser.js";
export type { ASTNode, TextNode, ArgNode, PluralNode, PluralCase, SelectNode, SelectCase } from "./icu-parser.js";
export { compileMessage, compileLocale } from "./icu-codegen.js";
export type { CompiledEntry, TranslationInput, CompiledLocaleModule } from "./icu-codegen.js";
