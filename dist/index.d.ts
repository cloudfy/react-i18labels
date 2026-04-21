export { I18nProvider, useTranslation, T } from "./react.js";
export type { I18nProviderProps, I18nConfig, LocaleLoader, TProps } from "./react.js";
export { detectLocale, persistLocale, clearPersistedLocale, matchLocale } from "./detect.js";
export type { DetectLocaleOptions } from "./detect.js";
export { formatNumber, formatCurrency, formatPercent, formatDate, formatRelative, formatRelativeAuto, formatList, } from "./format.js";
export type { DatePreset, FormatNumberOptions, ListStyle, RelativeUnit } from "./format.js";
export { pluralFn, ordinalFn } from "./plural.js";
export { parseICU, isComplex, collectArgs } from "./icu-parser.js";
export type { ASTNode, TextNode, ArgNode, PluralNode, PluralCase, SelectNode, SelectCase } from "./icu-parser.js";
export { compileMessage, compileLocale } from "./icu-codegen.js";
export type { CompiledEntry, TranslationInput, CompiledLocaleModule } from "./icu-codegen.js";
//# sourceMappingURL=index.d.ts.map