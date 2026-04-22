/**
 * Vite plugin for react-i18labels
 *
 * Compiles translation JSON files into virtual locale modules at build time
 * and during HMR in development.  The compiled modules are what
 * `loadLocale` dynamically imports at runtime.
 *
 * Setup in vite.config.ts:
 *
 *   import i18nLabels from "react-i18labels/vite-plugin";
 *
 *   export default defineConfig({
 *     plugins: [
 *       i18nLabels({ localesDir: "./locales" }),
 *     ],
 *   });
 *
 * Setup in your app's i18n config:
 *
 *   loadLocale: (locale) => import(`virtual:i18n/${locale}`)
 */
import type { Plugin } from "vite";
export interface I18nVitePluginOptions {
    /**
     * Directory (or glob) containing translation JSON files.
     * Each file must be named `<locale>.json` (e.g. `da.json`, `en.json`).
     * @example "./locales"
     * @example "./src/locales/*.json"
     */
    localesDir: string;
    /**
     * Locale used as the reference/source language.  Its keys become the
     * canonical set of source strings.
     * @default "en"
     */
    sourceLocale?: string;
    /**
     * Emit console warnings for missing translation keys during build.
     * @default true
     */
    warnOnMissing?: boolean;
    /**
     * Write an extraction manifest (list of all source strings) to disk
     * so CI / translators can diff what's missing.
     * @default false
     */
    emitManifest?: boolean;
    /**
     * Output path for the manifest file.
     * @default "dist/i18n-manifest.json"
     */
    manifestPath?: string;
    /**
     * Keep locale JSON files in sync with the source strings extracted from your
     * TypeScript/TSX files.
     *
     * - `"update"` — Add missing keys (empty placeholder value) and write the
     *   updated JSON back to disk.  Safe for local development and CI pipelines
     *   that commit the result.  Existing translations are never touched.
     * - `"check"`  — Fail the build when any locale is missing keys.  Use this
     *   in CI to enforce that translation files are always up-to-date before
     *   merging.
     * - `false`    — Do nothing (default, preserves previous behaviour).
     *
     * @default false
     */
    syncLocales?: "update" | "check" | false;
    /**
     * Locale codes to ensure exist as JSON files in `localesDir`.
     * When `syncLocales` is `"update"` and a listed locale has no file yet,
     * the plugin creates an empty stub and immediately populates it with all
     * extracted source strings as untranslated placeholders.
     * @example ["en", "da", "de"]
     */
    locales?: string[];
    /**
     * Separator placed between a namespace and a translation key when using
     * namespaced `useTranslation("namespace")` or `<T ns="namespace">`.
     * Must match the `namespaceSeparator` option in your `I18nConfig`.
     * @default "-"
     * @example namespaceSeparator: ":" → key becomes "admin:Settings"
     */
    namespaceSeparator?: string;
}
export default function i18nLabels(options: I18nVitePluginOptions): Plugin;
//# sourceMappingURL=vite-plugin.d.ts.map