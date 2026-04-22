import { Fragment as _Fragment, jsx as _jsx } from "react/jsx-runtime";
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
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, } from "react";
import { pluralFn } from "./plural.js";
import { formatNumber, formatCurrency, formatPercent, formatDate, formatRelative, formatRelativeAuto, formatList, } from "./format.js";
import { detectLocale, persistLocale } from "./detect.js";
// ─── Context ──────────────────────────────────────────────────────────────────
const I18nContext = createContext(null);
export function I18nProvider({ config, locale: localeProp, children, fallback }) {
    const [locale, setLocaleState] = useState(localeProp ?? detectLocale(config));
    const [messages, setMessages] = useState({});
    const [loading, setLoading] = useState(true);
    const loadAndActivate = useCallback(async (nextLocale) => {
        setLoading(true);
        try {
            const mod = await config.loadLocale(nextLocale);
            setMessages(mod.default);
            setLocaleState(nextLocale);
        }
        catch (err) {
            console.error(`[i18n] Failed to load locale "${nextLocale}":`, err);
            // Stay on current locale
        }
        finally {
            setLoading(false);
        }
    }, [config]);
    useEffect(() => { loadAndActivate(locale); }, [locale]);
    const setLocale = useCallback((next) => {
        persistLocale(next, config.storageKey);
        loadAndActivate(next);
    }, [config.storageKey, loadAndActivate]);
    const ctx = useMemo(() => ({ locale, messages, config, setLocale }), [locale, messages, config, setLocale]);
    if (loading && fallback)
        return _jsx(_Fragment, { children: fallback });
    return _jsx(I18nContext.Provider, { value: ctx, children: children });
}
// ─── Hook ─────────────────────────────────────────────────────────────────────
const isDev = globalThis.process?.env?.NODE_ENV !== "production";
export function useTranslation(namespace) {
    const ctx = useContext(I18nContext);
    if (!ctx)
        throw new Error("useTranslation must be used inside <I18nProvider>");
    const { locale, messages, config } = ctx;
    const warnOnMissing = config.warnOnMissing ?? isDev;
    const sep = config.namespaceSeparator ?? "-";
    /** Translate a source string, optionally with interpolation values. */
    const t = useCallback((source, values) => {
        const key = namespace ? `${namespace}${sep}${source}` : source;
        const entry = messages[key];
        if (entry === undefined) {
            if (warnOnMissing) {
                console.warn(`[i18n] Missing translation for locale "${locale}": ${JSON.stringify(key)}`);
            }
            // Graceful fallback: interpolate the source text as-is
            if (!values)
                return source;
            return source.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
        }
        if (typeof entry === "string")
            return entry;
        return entry(values ?? {}, pluralFn);
    }, [locale, messages, warnOnMissing, namespace, sep]);
    // ── Formatting convenience functions ────────────────────────────────────────
    const number = useCallback((value, options) => formatNumber(value, locale, options), [locale]);
    const currency = useCallback((value, currencyCode, options) => formatCurrency(value, currencyCode, locale, options), [locale]);
    const percent = useCallback((value, options) => formatPercent(value, locale, options), [locale]);
    const date = useCallback((value, format) => formatDate(value, locale, format), [locale]);
    const relative = useCallback((value, unit, style) => formatRelative(value, unit, locale, style), [locale]);
    const relativeAuto = useCallback((value, style) => formatRelativeAuto(value, locale, style), [locale]);
    const list = useCallback((items, style) => formatList(items, locale, style), [locale]);
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
export function T({ children, ns, ...values }) {
    const { locale, messages, config } = (() => {
        const ctx = useContext(I18nContext);
        if (!ctx)
            throw new Error("<T> must be used inside <I18nProvider>");
        return ctx;
    })();
    const sep = config.namespaceSeparator ?? "-";
    const source = children;
    const key = ns ? `${ns}${sep}${source}` : source;
    const entry = messages[key];
    const warnOnMissing = isDev;
    // Separate string values from React node values
    const stringValues = {};
    const reactValues = {};
    for (const [k, v] of Object.entries(values)) {
        if (React.isValidElement(v) || (typeof v !== "string" && typeof v !== "number")) {
            reactValues[k] = v;
        }
        else {
            stringValues[k] = v;
        }
    }
    const hasReactValues = Object.keys(reactValues).length > 0;
    // Fast path: no React node interpolation
    if (!hasReactValues) {
        if (entry === undefined) {
            if (warnOnMissing)
                console.warn(`[i18n] Missing: ${JSON.stringify(key)}`);
            return source;
        }
        const translated = typeof entry === "string" ? entry : entry(stringValues, pluralFn);
        return translated;
    }
    // Rich interpolation path — replace {tag}...{/tag} with cloned React elements
    const translated = (() => {
        if (entry === undefined)
            return source;
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
function renderRichMessage(message, nodes) {
    // Split on {tag} and {/tag} patterns
    const parts = message.split(/(\{\/?\w+\})/);
    const result = [];
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
                result.push(React.cloneElement(wrapper, { key: key++ }, inner));
            }
            else {
                result.push(inner);
            }
        }
        else if (part) {
            result.push(part);
            i++;
        }
        else {
            i++;
        }
    }
    return result.length === 1 ? result[0] : _jsx(_Fragment, { children: result });
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
export function translate(source, messages, locale, values) {
    const entry = messages[source];
    if (!entry)
        return source;
    if (typeof entry === "string")
        return entry;
    return entry(values ?? {}, pluralFn);
}
//# sourceMappingURL=react.js.map