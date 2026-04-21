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

import fs from "node:fs";
import path from "node:path";
import type { Plugin, ViteDevServer, ResolvedConfig } from "vite";
import glob from "fast-glob";
import { compileLocale, extractMessages } from "./icu-codegen.js";

// ─── Options ─────────────────────────────────────────────────────────────────

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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VIRTUAL_PREFIX = "virtual:i18n/";
const RESOLVED_PREFIX = "\0virtual:i18n/";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Read and parse a JSON translation file. Returns {} on any error. */
function readTranslationFile(filePath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Resolve all locale JSON files matching the configured localesDir.
 * Returns a map of { locale → absolutePath }.
 */
function resolveLocaleFiles(localesDir: string, root: string): Map<string, string> {
  const map = new Map<string, string>();

  // If localesDir looks like a plain directory, expand it to a glob
  const pattern = localesDir.endsWith(".json")
    ? localesDir
    : path.join(localesDir, "*.json").replace(/\\/g, "/");

  const absolutePattern = path.isAbsolute(pattern)
    ? pattern
    : path.join(root, pattern).replace(/\\/g, "/");

  const files = glob.sync(absolutePattern);
  for (const file of files) {
    const locale = path.basename(file, ".json");
    map.set(locale, path.resolve(file));
  }
  return map;
}

/**
 * Scan TypeScript/TSX source files under `srcDir` and extract source strings.
 * Falls back to an empty array when no source files exist yet.
 */
function extractSourceMessages(srcDir: string): string[] {
  const files = glob.sync(path.join(srcDir, "**/*.{ts,tsx}").replace(/\\/g, "/"));
  const messages = new Set<string>();
  for (const file of files) {
    try {
      const src = fs.readFileSync(file, "utf-8");
      for (const msg of extractMessages(src)) {
        messages.add(msg);
      }
    } catch {
      // skip unreadable files
    }
  }
  return [...messages];
}

// ─── Sync helper ─────────────────────────────────────────────────────────────

/**
 * Synchronise locale JSON files against the current set of source strings.
 *
 * "update" mode  — writes missing keys (empty string placeholder) back to
 *   disk.  Existing translations are preserved.  Stale keys are left in place
 *   so translators can review them manually.
 *
 * "check" mode   — throws an error listing every missing key so the build
 *   fails fast in CI.
 */
function syncLocaleFiles(
  sourceMessages: string[],
  localeFiles: Map<string, string>,
  mode: "update" | "check",
  root: string,
  onError: (msg: string) => void,
  onInfo: (msg: string) => void,
): void {
  const allMissing: Array<{ locale: string; keys: string[] }> = [];

  for (const [locale, filePath] of localeFiles) {
    const existing = readTranslationFile(filePath);
    const missingKeys = sourceMessages.filter((m) => !(m in existing));
    if (missingKeys.length === 0) continue;
    allMissing.push({ locale, keys: missingKeys });

    if (mode === "update") {
      const updated = { ...existing };
      for (const key of missingKeys) {
        updated[key] = ""; // empty string flags it as needing translation
      }
      fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
      onInfo(
        `[i18n] "${locale}": added ${missingKeys.length} missing key(s) → ${path.relative(root, filePath)}`,
      );
    }
  }

  if (mode === "check" && allMissing.length > 0) {
    const detail = allMissing
      .map(
        ({ locale, keys }) =>
          `  Locale "${locale}" — ${keys.length} missing key(s):\n` +
          keys.map((k) => `    • ${JSON.stringify(k)}`).join("\n"),
      )
      .join("\n");
    onError(
      `[i18n] Translation sync failed. Run the build with syncLocales: "update" to fix automatically.\n${detail}`,
    );
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default function i18nLabels(options: I18nVitePluginOptions): Plugin {
  const {
    localesDir,
    sourceLocale = "en",
    warnOnMissing = true,
    emitManifest = false,
    manifestPath = "dist/i18n-manifest.json",
    syncLocales = false,
  } = options;

  let root = process.cwd();
  let srcDir = path.join(root, "src");

  // In-memory cache: locale → compiled JS string
  const cache = new Map<string, string>();

  /** Compile (or recompile) a single locale and update the cache. */
  function compile(locale: string, filePath: string): string {
    const translations = readTranslationFile(filePath);
    const sourceMessages = extractSourceMessages(srcDir);

    const { code, stats } = compileLocale(locale, translations, sourceMessages);

    if (warnOnMissing && stats.missing > 0) {
      console.warn(
        `[i18n] Locale "${locale}": ${stats.missing} missing translation(s) out of ${stats.total}`,
      );
    }

    cache.set(locale, code);
    return code;
  }

  /** Compile all known locale files and populate the cache. */
  function compileAll(): void {
    const localeFiles = resolveLocaleFiles(localesDir, root);
    for (const [locale, filePath] of localeFiles) {
      compile(locale, filePath);
    }
  }

  return {
    name: "react-i18labels",
    enforce: "pre",

    configResolved(config: ResolvedConfig) {
      root = config.root;
      srcDir = path.join(root, "src");
    },

    buildStart() {
      if (syncLocales) {
        const sourceMessages = extractSourceMessages(srcDir);
        const localeFiles = resolveLocaleFiles(localesDir, root);
        syncLocaleFiles(
          sourceMessages,
          localeFiles,
          syncLocales,
          root,
          (msg) => { throw new Error(msg); },
          (msg) => console.info(msg),
        );
      }
      compileAll();
    },


    // ── Virtual module resolution ─────────────────────────────────────────────

    resolveId(id: string) {
      if (id.startsWith(VIRTUAL_PREFIX)) {
        return RESOLVED_PREFIX + id.slice(VIRTUAL_PREFIX.length);
      }
    },

    load(id: string) {
      if (!id.startsWith(RESOLVED_PREFIX)) return;

      const locale = id.slice(RESOLVED_PREFIX.length);

      if (cache.has(locale)) {
        return cache.get(locale);
      }

      // Locale not yet compiled — try to find and compile it on demand
      const localeFiles = resolveLocaleFiles(localesDir, root);
      const filePath = localeFiles.get(locale);

      if (!filePath) {
        this.warn(`[i18n] No translation file found for locale "${locale}"`);
        return `export default {};`;
      }

      return compile(locale, filePath);
    },

    // ── HMR: watch translation JSON files ────────────────────────────────────

    configureServer(server: ViteDevServer) {
      const localeFiles = resolveLocaleFiles(localesDir, root);

      // Watch locale JSON files
      for (const [, filePath] of localeFiles) {
        server.watcher.add(filePath);
      }

      // Watch source TS/TSX files so new t() calls sync immediately in dev
      if (syncLocales === "update") {
        server.watcher.add(path.join(srcDir, "**/*.{ts,tsx}"));
      }

      server.watcher.on("change", (changedPath: string) => {
        const resolvedChanged = path.resolve(changedPath);
        const currentLocaleFiles = resolveLocaleFiles(localesDir, root);

        // ── A translation JSON file changed ──────────────────────────────────
        for (const [locale, filePath] of currentLocaleFiles) {
          if (resolvedChanged === filePath) {
            compile(locale, filePath);
            const moduleId = RESOLVED_PREFIX + locale;
            const mod = server.moduleGraph.getModuleById(moduleId);
            if (mod) {
              server.moduleGraph.invalidateModule(mod);
              server.hot.send({ type: "full-reload" });
            }
            return;
          }
        }

        // ── A source file changed — sync new keys then recompile ─────────────
        if (syncLocales === "update" && /\.(tsx?)$/.test(changedPath)) {
          const sourceMessages = extractSourceMessages(srcDir);
          syncLocaleFiles(
            sourceMessages,
            currentLocaleFiles,
            "update",
            root,
            (msg) => console.error(msg),
            (msg) => console.info(msg),
          );
          // Recompile all locales (JSON files may have been updated on disk)
          for (const [locale, filePath] of currentLocaleFiles) {
            compile(locale, filePath);
          }
          server.hot.send({ type: "full-reload" });
        }
      });
    },

    // ── Build: emit manifest ──────────────────────────────────────────────────

    generateBundle() {
      if (!emitManifest) return;

      const sourceMessages = extractSourceMessages(srcDir);
      const localeFiles = resolveLocaleFiles(localesDir, root);

      const localeStats: Record<string, { total: number; missing: number }> = {};
      for (const [locale, filePath] of localeFiles) {
        const translations = readTranslationFile(filePath);
        const missing = sourceMessages.filter((m) => !translations[m]);
        localeStats[locale] = { total: sourceMessages.length, missing: missing.length };
      }

      const manifest = {
        generatedAt: new Date().toISOString(),
        sourceLocale,
        messages: sourceMessages,
        locales: localeStats,
      };

      const absManifestPath = path.isAbsolute(manifestPath)
        ? manifestPath
        : path.join(root, manifestPath);

      fs.mkdirSync(path.dirname(absManifestPath), { recursive: true });
      fs.writeFileSync(absManifestPath, JSON.stringify(manifest, null, 2), "utf-8");
    },
  };
}
