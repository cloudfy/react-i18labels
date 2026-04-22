/**
 * React runtime — useTranslation hook and <T> component
 *
 * Wires together:
 *   - Compiled locale ES modules (loaded via dynamic import)
 *   - pluralFn  (runtime plural resolution, ~400 B)
 *   - Intl formatting helpers (zero bundle cost, native APIs)
 *   - Locale detection
 *
 * Provides:
 *   <I18nProvider>    Context + locale loader
 *   useTranslation()  Hook: t(), formatNumber(), formatDate(), …
 *   <T>               JSX component with rich React children
 */
import { type ReactNode } from "react";
import { pluralFn } from "./plural.js";
import { formatCurrency, formatPercent, type DatePreset, type FormatNumberOptions, type ListStyle, type RelativeUnit } from "./format.js";
import { type DetectLocaleOptions } from "./detect.js";
/** A compiled locale entry: plain string or a function. */
type MessageEntry = string | ((values: Record<string, unknown>, pf: typeof pluralFn) => string);
/** Shape of a compiled locale module's default export. */
type LocaleMessages = Record<string, MessageEntry>;
/** Loader function — maps a locale string to a dynamic import. */
export type LocaleLoader = (locale: string) => Promise<{
    default: LocaleMessages;
}>;
export interface I18nConfig extends DetectLocaleOptions {
    /** How to load a compiled locale module. Typically a dynamic import. */
    loadLocale: LocaleLoader;
    /**
     * Emit a console.warn in dev mode when a translation is missing.
     * Default: true in development, false in production.
     */
    warnOnMissing?: boolean;
    /**
     * Separator used between a namespace and a translation key.
     * Must match the `namespaceSeparator` option in the Vite plugin.
     * @default "-"
     * @example namespaceSeparator: ":" → key becomes "admin:Settings"
     */
    namespaceSeparator?: string;
    /**
     * Translator context comment — attached to the message in the manifest
     * so translators understand ambiguous strings.  Not used at runtime.
     */
    _comment?: string;
}
export interface I18nProviderProps {
    config: I18nConfig;
    /** Override the detected locale (e.g. from SSR). */
    locale?: string;
    children: ReactNode;
    /** Optional fallback UI while the locale module loads. */
    fallback?: ReactNode;
}
export declare function I18nProvider({ config, locale: localeProp, children, fallback }: I18nProviderProps): import("react/jsx-runtime").JSX.Element;
export declare function useTranslation(namespace?: string): {
    t: (source: string, values?: Record<string, unknown>) => string;
    locale: string;
    setLocale: (locale: string) => void;
    formatNumber: (value: number, options?: FormatNumberOptions) => string;
    formatCurrency: (value: number, currencyCode: string, options?: Parameters<typeof formatCurrency>[3]) => string;
    formatPercent: (value: number, options?: Parameters<typeof formatPercent>[2]) => string;
    formatDate: (value: Date | string | number, format?: DatePreset | Intl.DateTimeFormatOptions) => string;
    formatRelative: (value: number, unit: RelativeUnit, style?: Intl.RelativeTimeFormatStyle) => string;
    formatRelativeAuto: (value: Date | string | number, style?: Intl.RelativeTimeFormatStyle) => string;
    formatList: (items: string[], style?: ListStyle) => string;
};
/**
 * Translate a string in JSX with optional interpolated React nodes.
 *
 * Simple:
 *   <T>Settings</T>
 *
 * With string interpolation:
 *   <T name={user.name}>Hello, {"{name}"}!</T>
 *
 * With rich React children (no dangerouslySetInnerHTML needed):
 *   <T link={<a href="/terms" />}>{"By continuing you agree to {link}our terms{/link}"}</T>
 *
 * The source string is the first text child — what you see is what you edit.
 */
export interface TProps {
    children: string;
    /** Optional namespace prefix. The lookup key becomes `{ns}{separator}{children}`. */
    ns?: string;
    [interpolation: string]: ReactNode;
}
export declare function T({ children, ns, ...values }: TProps): ReactNode;
/**
 * Translate a string outside React (e.g. in Zod schemas, error constants).
 * Requires passing the messages map explicitly — use sparingly.
 *
 * @example
 *   import { translate } from "@yourorg/i18n/core";
 *   const msg = translate("Field is required", daMessages, "da");
 */
export declare function translate(source: string, messages: LocaleMessages, locale: string, values?: Record<string, unknown>): string;
export {};
//# sourceMappingURL=react.d.ts.map