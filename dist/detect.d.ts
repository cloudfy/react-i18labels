/**
 * Locale detection
 *
 * Resolves the best available locale from a priority chain.  Each source is
 * tried in order; the first that produces a supported locale wins.
 *
 * Default priority:
 *   1. Explicit override (e.g. user's saved preference in localStorage)
 *   2. URL path segment  (/da/products → "da")
 *   3. Query param       (?lang=da)
 *   4. Cookie            (i18n_locale=da)
 *   5. navigator.languages (browser preference list)
 *   6. navigator.language
 *   7. Config default locale
 *
 * Usage:
 *
 *   import { detectLocale } from "@yourorg/i18n/detect";
 *
 *   const locale = detectLocale({
 *     supported: ["en", "da", "de", "fr"],
 *     default: "en",
 *     // Optional overrides:
 *     cookieName: "app_locale",    // default: "i18n_locale"
 *     queryParam: "lang",          // default: "lang"
 *     pathIndex: 1,                // which path segment to check (1 = /[locale]/...)
 *     storageKey: "preferred_locale",
 *   });
 */
export interface DetectLocaleOptions {
    /** All locales your app supports (e.g. ["en", "da", "de"]) */
    supported: string[];
    /** Fallback when nothing matches */
    default: string;
    /** localStorage / sessionStorage key for explicit user preference */
    storageKey?: string;
    /** URL query param name (default: "lang") */
    queryParam?: string;
    /** Which 1-indexed URL path segment to check (default: 1 → /[locale]/…) */
    pathIndex?: number;
    /** Cookie name (default: "i18n_locale") */
    cookieName?: string;
}
/**
 * Match a raw locale string against the supported list.
 *
 * Tries exact match first, then language-only prefix ("da-DK" → "da").
 * Returns null if no match found.
 */
export declare function matchLocale(raw: string | undefined | null, supported: string[]): string | null;
/**
 * Detect the best locale for the current user.
 */
export declare function detectLocale(options: DetectLocaleOptions): string;
/**
 * Persist an explicit locale preference so it wins on the next visit.
 */
export declare function persistLocale(locale: string, storageKey?: string): void;
/**
 * Clear a persisted locale preference.
 */
export declare function clearPersistedLocale(storageKey?: string): void;
//# sourceMappingURL=detect.d.ts.map