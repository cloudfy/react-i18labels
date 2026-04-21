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
export function matchLocale(raw: string | undefined | null, supported: string[]): string | null {
  if (!raw) return null;
  const normalised = raw.trim().toLowerCase();

  // Exact match (case-insensitive)
  const exact = supported.find((s) => s.toLowerCase() === normalised);
  if (exact) return exact;

  // Language prefix: "da-DK" → "da", "zh-Hant-TW" → "zh"
  const lang = normalised.split(/[-_]/)[0];
  const prefix = supported.find((s) => s.toLowerCase() === lang);
  return prefix ?? null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function readStorage(key: string): string | null {
  try {
    return (
      (typeof localStorage !== "undefined" && localStorage.getItem(key)) ||
      (typeof sessionStorage !== "undefined" && sessionStorage.getItem(key)) ||
      null
    );
  } catch {
    return null; // private/incognito may throw
  }
}

function readQueryParam(param: string): string | null {
  if (typeof location === "undefined") return null;
  try {
    return new URLSearchParams(location.search).get(param);
  } catch {
    return null;
  }
}

function readPathSegment(index: number): string | null {
  if (typeof location === "undefined") return null;
  const parts = location.pathname.split("/").filter(Boolean);
  return parts[index - 1] ?? null;
}

/**
 * Detect the best locale for the current user.
 */
export function detectLocale(options: DetectLocaleOptions): string {
  const {
    supported,
    default: defaultLocale,
    storageKey = "i18n_locale",
    queryParam = "lang",
    pathIndex = 1,
    cookieName = "i18n_locale",
  } = options;

  const sources: Array<() => string | null> = [
    () => readStorage(storageKey),
    () => readPathSegment(pathIndex),
    () => readQueryParam(queryParam),
    () => readCookie(cookieName),
    () => {
      // navigator.languages — full preference list
      if (typeof navigator === "undefined") return null;
      const langs = Array.isArray(navigator.languages) ? navigator.languages : [];
      for (const lang of langs) {
        const match = matchLocale(lang, supported);
        if (match) return match;
      }
      return null;
    },
    () => (typeof navigator !== "undefined" ? matchLocale(navigator.language, supported) : null),
  ];

  for (const source of sources) {
    const candidate = source();
    const matched = matchLocale(candidate, supported);
    if (matched) return matched;
  }

  return defaultLocale;
}

/**
 * Persist an explicit locale preference so it wins on the next visit.
 */
export function persistLocale(locale: string, storageKey = "i18n_locale"): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(storageKey, locale);
    }
  } catch {
    // ignore
  }
}

/**
 * Clear a persisted locale preference.
 */
export function clearPersistedLocale(storageKey = "i18n_locale"): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  } catch {
    // ignore
  }
}
