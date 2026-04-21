# react-i18labels

A React library for internationalization and localization using ICU message format and native `Intl` APIs.

## Installation

```bash
npm install react-i18labels
```

React ≥ 17 is a peer dependency and must be installed in your project.

---

## Basic usage with React + TypeScript

### 1. Create translation files

Translation files are plain JSON — keys are the English source strings, values are the translated strings (or ICU message patterns).

```json
// locales/da.json
{
  "Settings": "Indstillinger",
  "Hello, {name}!": "Hej, {name}!",
  "You have {count, plural, one {# item} other {# items}} in your cart": "Du har {count, plural, one {# vare} other {# varer}} i din indkøbskurv"
}
```

### 2. Configure `I18nProvider`

Wrap your app with `I18nProvider` and pass a `config` object. The `loadLocale` function tells the library how to load a compiled locale module at runtime.

```tsx
// i18n.config.ts
import type { I18nConfig } from "react-i18labels";

export const i18nConfig: I18nConfig = {
  supported: ["en", "da", "de"],
  default: "en",
  storageKey: "preferred_locale",   // persists the user's choice in localStorage
  loadLocale: (locale) => import(`virtual:i18n/${locale}`),
};
```

```tsx
// App.tsx
import { I18nProvider } from "react-i18labels";
import { i18nConfig } from "./i18n.config";

export default function App({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider config={i18nConfig} fallback={<div>Loading…</div>}>
      {children}
    </I18nProvider>
  );
}
```

### 3. Translate with `useTranslation`

```tsx
import { useTranslation } from "react-i18labels";

function CartPage({ user, itemCount }: { user: string; itemCount: number }) {
  const { t, locale, setLocale } = useTranslation();

  return (
    <div>
      <h1>{t("Settings")}</h1>
      <p>{t("Hello, {name}!", { name: user })}</p>
      <p>
        {t(
          "You have {count, plural, one {# item} other {# items}} in your cart",
          { count: itemCount },
        )}
      </p>

      <button onClick={() => setLocale("da")}>Dansk</button>
      <button onClick={() => setLocale("en")}>English</button>
      <span>Active locale: {locale}</span>
    </div>
  );
}
```

### 4. Translate with the `<T>` component

`<T>` is the JSX equivalent of `t()`. The source string is the text content — what you see in the editor is exactly what you search for in your translation files.

```tsx
import { T } from "react-i18labels";

// Plain string
<T>Settings</T>

// With string interpolation
<T name={user.name}>{"Hello, {name}!"}</T>

// With a React node interpolation (no dangerouslySetInnerHTML needed)
<T link={<a href="/terms">our terms</a>}>
  {"By continuing you agree to {link}our terms{/link}"}
</T>
```

### 5. Formatting helpers

`useTranslation` also exposes locale-aware formatting utilities backed by native `Intl` APIs.

```tsx
const { formatNumber, formatCurrency, formatPercent, formatDate, formatRelativeAuto, formatList } =
  useTranslation();

formatNumber(1234567.89)                              // "1,234,567.89"  (en)
formatCurrency(9.99, "EUR")                           // "€9.99"
formatPercent(0.42)                                   // "42%"
formatDate(new Date(), "long")                        // "April 21, 2026"
formatDate(new Date(), "short")                       // "4/21/26"
formatRelativeAuto(new Date(Date.now() - 86400000))   // "yesterday"
formatList(["apples", "bananas", "oranges"])          // "apples, bananas, and oranges"
```

---

## Vite plugin

The Vite plugin compiles your translation JSON files into optimised virtual locale modules at build time and supports HMR during development — no manual compile step needed.

### Installation

```bash
npm install --save-dev vite
```

### 1. Configure the plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import i18nLabels from "react-i18labels/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    i18nLabels({
      localesDir: "./locales",   // directory containing <locale>.json files
      sourceLocale: "en",        // reference language (default: "en")
      warnOnMissing: true,       // warn on missing keys during build (default: true)
    }),
  ],
});
```

### 2. Add the virtual module type declaration

Create a file in your project (e.g. `src/vite-env.d.ts`) to satisfy TypeScript:

```ts
/// <reference types="vite/client" />

declare module "virtual:i18n/*" {
  const messages: Record<string, string | ((values: Record<string, unknown>, pf: unknown) => string)>;
  export default messages;
}
```

### 3. Use `virtual:i18n/<locale>` in your config

```ts
// i18n.config.ts
import type { I18nConfig } from "react-i18labels";

export const i18nConfig: I18nConfig = {
  supported: ["en", "da", "de"],
  default: "en",
  loadLocale: (locale) => import(`virtual:i18n/${locale}`),
};
```

The plugin resolves each `virtual:i18n/<locale>` import to the compiled output of the corresponding `locales/<locale>.json` file. Changing a JSON file during development triggers HMR automatically.

### Plugin options

| Option | Type | Default | Description |
|---|---|---|---|
| `localesDir` | `string` | — | Directory (or glob) containing `<locale>.json` files. **Required.** |
| `sourceLocale` | `string` | `"en"` | Reference locale used for source string extraction. |
| `warnOnMissing` | `boolean` | `true` | Log a warning when a locale has untranslated keys. |
| `emitManifest` | `boolean` | `false` | Write a `i18n-manifest.json` with all extracted strings and per-locale missing counts. |
| `manifestPath` | `string` | `"dist/i18n-manifest.json"` | Output path for the manifest file. |
| `syncLocales` | `"update" \| "check" \| false` | `false` | Automatically keep locale JSON files in sync with source strings (see below). |

### Manifest file

When `emitManifest: true` is set, the plugin writes a JSON file at build time that lists every extracted source string and how many are missing per locale. This is useful for CI checks or handing off to translators.

```json
{
  "generatedAt": "2026-04-21T12:00:00.000Z",
  "sourceLocale": "en",
  "messages": ["Settings", "Hello, {name}!", "…"],
  "locales": {
    "da": { "total": 42, "missing": 0 },
    "de": { "total": 42, "missing": 3 }
  }
}
```

### Locale sync (`syncLocales`)

The plugin can keep your `locales/*.json` files in sync with the strings extracted from your source code automatically — no manual extraction step needed.

```ts
i18nLabels({
  localesDir: "./locales",
  syncLocales: "update", // recommended for local development
})
```

| Value | Behaviour |
|---|---|
| `"update"` | Scans `src/**/*.{ts,tsx}` at build start for `t()` / `<T>` calls. Adds any missing keys to each locale JSON file with an empty string placeholder. Existing translations are never touched. In dev mode, also watches source files — saving a file with a new `t()` call instantly updates the JSONs and triggers HMR. |
| `"check"` | Same scan, but **fails the build** if any locale is missing keys. Use this in CI to enforce that translation files are always committed and up-to-date. |
| `false` | Do nothing (default). |

**Recommended setup:**

```ts
// vite.config.ts
i18nLabels({
  localesDir: "./locales",
  syncLocales: process.env.CI ? "check" : "update",
})
```

---

## Locale detection

`I18nProvider` automatically detects the best locale from the following sources (in priority order):

1. `localStorage` / `sessionStorage` (key set via `storageKey`)
2. URL path segment (e.g. `/da/products` → `"da"`, controlled by `pathIndex`)
3. URL query parameter (e.g. `?lang=da`, controlled by `queryParam`)
4. Cookie (controlled by `cookieName`)
5. `navigator.languages`
6. `navigator.language`
7. `config.default`

You can also pass a `locale` prop directly to `<I18nProvider>` to override detection (useful for SSR).
