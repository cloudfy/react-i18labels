// ─── React runtime ────────────────────────────────────────────────────────────
export { I18nProvider, useTranslation, T } from "./react";
export type { I18nProviderProps, I18nConfig, LocaleLoader, TProps } from "./react";

// ─── Locale detection ─────────────────────────────────────────────────────────
export { detectLocale, persistLocale, clearPersistedLocale, matchLocale } from "./detect";
export type { DetectLocaleOptions } from "./detect";

// ─── Formatting ───────────────────────────────────────────────────────────────
export {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatRelative,
  formatRelativeAuto,
  formatList,
} from "./format";
export type { DatePreset, FormatNumberOptions, ListStyle, RelativeUnit } from "./format";

// ─── Plural resolution ────────────────────────────────────────────────────────
export { pluralFn, ordinalFn } from "./plural";

// ─── Build-time compiler ──────────────────────────────────────────────────────
export { parseICU, isComplex, collectArgs } from "./icu-parser";
export type { ASTNode, TextNode, ArgNode, PluralNode, PluralCase, SelectNode, SelectCase } from "./icu-parser";
export { compileMessage, compileLocale } from "./icu-codegen";
export type { CompiledEntry, TranslationInput, CompiledLocaleModule } from "./icu-codegen";
