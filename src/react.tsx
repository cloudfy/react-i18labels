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

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { pluralFn } from "./plural";
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatDate,
  formatRelative,
  formatRelativeAuto,
  formatList,
  type DatePreset,
  type FormatNumberOptions,
  type ListStyle,
  type RelativeUnit,
} from "./format";
import { detectLocale, persistLocale, type DetectLocaleOptions } from "./detect";

// ─── Types ────────────────────────────────────────────────────────────────────

/** A compiled locale entry: plain string or a function. */
type MessageEntry = string | ((values: Record<string, unknown>, pf: typeof pluralFn) => string);

/** Shape of a compiled locale module's default export. */
type LocaleMessages = Record<string, MessageEntry>;

/** Loader function — maps a locale string to a dynamic import. */
export type LocaleLoader = (locale: string) => Promise<{ default: LocaleMessages }>;

export interface I18nConfig extends DetectLocaleOptions {
  /** How to load a compiled locale module. Typically a dynamic import. */
  loadLocale: LocaleLoader;
  /**
   * Emit a console.warn in dev mode when a translation is missing.
   * Default: true in development, false in production.
   */
  warnOnMissing?: boolean;
  /**
   * Translator context comment — attached to the message in the manifest
   * so translators understand ambiguous strings.  Not used at runtime.
   */
  _comment?: string;
}

interface I18nContextValue {
  locale: string;
  messages: LocaleMessages;
  config: I18nConfig;
  setLocale: (locale: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface I18nProviderProps {
  config: I18nConfig;
  /** Override the detected locale (e.g. from SSR). */
  locale?: string;
  children: ReactNode;
  /** Optional fallback UI while the locale module loads. */
  fallback?: ReactNode;
}

export function I18nProvider({ config, locale: localeProp, children, fallback }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<string>(
    localeProp ?? detectLocale(config),
  );
  const [messages, setMessages] = useState<LocaleMessages>({});
  const [loading, setLoading] = useState(true);

  const loadAndActivate = useCallback(
    async (nextLocale: string) => {
      setLoading(true);
      try {
        const mod = await config.loadLocale(nextLocale);
        setMessages(mod.default);
        setLocaleState(nextLocale);
      } catch (err) {
        console.error(`[i18n] Failed to load locale "${nextLocale}":`, err);
        // Stay on current locale
      } finally {
        setLoading(false);
      }
    },
    [config],
  );

  useEffect(() => { loadAndActivate(locale); }, [locale]);

  const setLocale = useCallback(
    (next: string) => {
      persistLocale(next, config.storageKey);
      loadAndActivate(next);
    },
    [config.storageKey, loadAndActivate],
  );

  const ctx = useMemo<I18nContextValue>(
    () => ({ locale, messages, config, setLocale }),
    [locale, messages, config, setLocale],
  );

  if (loading && fallback) return <>{fallback}</>;

  return <I18nContext.Provider value={ctx}>{children}</I18nContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const isDev = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== "production";

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useTranslation must be used inside <I18nProvider>");

  const { locale, messages, config } = ctx;
  const warnOnMissing = config.warnOnMissing ?? isDev;

  /** Translate a source string, optionally with interpolation values. */
  const t = useCallback(
    (source: string, values?: Record<string, unknown>): string => {
      const entry = messages[source];

      if (entry === undefined) {
        if (warnOnMissing) {
          console.warn(`[i18n] Missing translation for locale "${locale}": ${JSON.stringify(source)}`);
        }
        // Graceful fallback: interpolate the source text as-is
        if (!values) return source;
        return source.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
      }

      if (typeof entry === "string") return entry;
      return entry(values ?? {}, pluralFn);
    },
    [locale, messages, warnOnMissing],
  );

  // ── Formatting convenience functions ────────────────────────────────────────

  const number = useCallback(
    (value: number, options?: FormatNumberOptions) => formatNumber(value, locale, options),
    [locale],
  );
  const currency = useCallback(
    (value: number, currencyCode: string, options?: Parameters<typeof formatCurrency>[3]) =>
      formatCurrency(value, currencyCode, locale, options),
    [locale],
  );
  const percent = useCallback(
    (value: number, options?: Parameters<typeof formatPercent>[2]) =>
      formatPercent(value, locale, options),
    [locale],
  );
  const date = useCallback(
    (value: Date | string | number, format?: DatePreset | Intl.DateTimeFormatOptions) =>
      formatDate(value, locale, format),
    [locale],
  );
  const relative = useCallback(
    (value: number, unit: RelativeUnit, style?: Intl.RelativeTimeFormatStyle) =>
      formatRelative(value, unit, locale, style),
    [locale],
  );
  const relativeAuto = useCallback(
    (value: Date | string | number, style?: Intl.RelativeTimeFormatStyle) =>
      formatRelativeAuto(value, locale, style),
    [locale],
  );
  const list = useCallback(
    (items: string[], style?: ListStyle) => formatList(items, locale, style),
    [locale],
  );

  return {
    t,
    locale,
    setLocale: ctx.setLocale,
    // Formatting
    formatNumber: number,
    formatCurrency: currency,
    formatPercent: percent,
    formatDate: date,
    formatRelative: relative,
    formatRelativeAuto: relativeAuto,
    formatList: list,
  };
}

// ─── <T> JSX component ────────────────────────────────────────────────────────

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
  [interpolation: string]: ReactNode;
}

export function T({ children, ...values }: TProps): ReactNode {
  const { locale, messages } = (() => {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error("<T> must be used inside <I18nProvider>");
    return ctx;
  })();

  const source = children;
  const entry = messages[source];
  const warnOnMissing = isDev;

  // Separate string values from React node values
  const stringValues: Record<string, unknown> = {};
  const reactValues: Record<string, ReactNode> = {};

  for (const [k, v] of Object.entries(values)) {
    if (React.isValidElement(v) || (typeof v !== "string" && typeof v !== "number")) {
      reactValues[k] = v;
    } else {
      stringValues[k] = v;
    }
  }

  const hasReactValues = Object.keys(reactValues).length > 0;

  // Fast path: no React node interpolation
  if (!hasReactValues) {
    if (entry === undefined) {
      if (warnOnMissing) console.warn(`[i18n] Missing: ${JSON.stringify(source)}`);
      return source;
    }
    const translated = typeof entry === "string" ? entry : entry(stringValues, pluralFn);
    return translated;
  }

  // Rich interpolation path — replace {tag}...{/tag} with cloned React elements
  const translated = (() => {
    if (entry === undefined) return source;
    return typeof entry === "string" ? entry : entry(stringValues, pluralFn);
  })();

  return renderRichMessage(translated, reactValues);
}

/**
 * Parse and render a translated message that contains {tag}...{/tag} wrappers.
 *
 * The value for "link" in <T link={<a href="…" />}> is used as the wrapper
 * element around the inner text.  We clone it with the inner text as children.
 */
function renderRichMessage(
  message: string,
  nodes: Record<string, ReactNode>,
): ReactNode {
  // Split on {tag} and {/tag} patterns
  const parts = message.split(/(\{\/?\w+\})/);
  const result: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < parts.length) {
    const part = parts[i];
    const openMatch = part.match(/^\{(\w+)\}$/);
    if (openMatch) {
      const tagName = openMatch[1];
      const wrapper = nodes[tagName];
      // Collect content until {/tagName}
      const closeTag = `{/${tagName}}`;
      let inner = "";
      i++;
      while (i < parts.length && parts[i] !== closeTag) {
        inner += parts[i++];
      }
      i++; // skip close tag
      if (React.isValidElement(wrapper)) {
        result.push(React.cloneElement(wrapper as React.ReactElement<{children: ReactNode}>, { key: key++ }, inner));
      } else {
        result.push(inner);
      }
    } else if (part) {
      result.push(part);
      i++;
    } else {
      i++;
    }
  }

  return result.length === 1 ? result[0] : <>{result}</>;
}

// ─── translate() — outside React ─────────────────────────────────────────────

/**
 * Translate a string outside React (e.g. in Zod schemas, error constants).
 * Requires passing the messages map explicitly — use sparingly.
 *
 * @example
 *   import { translate } from "@yourorg/i18n/core";
 *   const msg = translate("Field is required", daMessages, "da");
 */
export function translate(
  source: string,
  messages: LocaleMessages,
  locale: string,
  values?: Record<string, unknown>,
): string {
  const entry = messages[source];
  if (!entry) return source;
  if (typeof entry === "string") return entry;
  return entry(values ?? {}, pluralFn);
}
