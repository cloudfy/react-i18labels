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
import { compileLocale, extractMessages } from "./icu-codegen";

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

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default function i18nLabels(options: I18nVitePluginOptions): Plugin {
  const {
    localesDir,
    sourceLocale = "en",
    warnOnMissing = true,
    emitManifest = false,
    manifestPath = "dist/i18n-manifest.json",
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

      for (const [locale, filePath] of localeFiles) {
        server.watcher.add(filePath);
      }

      server.watcher.on("change", (changedPath: string) => {
        // Check if the changed file is one of our translation files
        for (const [locale, filePath] of resolveLocaleFiles(localesDir, root)) {
          if (path.resolve(changedPath) === filePath) {
            compile(locale, filePath);

            // Invalidate the virtual module so Vite triggers a re-import
            const moduleId = RESOLVED_PREFIX + locale;
            const mod = server.moduleGraph.getModuleById(moduleId);
            if (mod) {
              server.moduleGraph.invalidateModule(mod);
              server.hot.send({ type: "full-reload" });
            }
            break;
          }
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
