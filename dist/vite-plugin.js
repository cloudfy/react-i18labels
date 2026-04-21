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
import glob from "fast-glob";
import { compileLocale, extractMessages } from "./icu-codegen";
// ─── Constants ────────────────────────────────────────────────────────────────
const VIRTUAL_PREFIX = "virtual:i18n/";
const RESOLVED_PREFIX = "\0virtual:i18n/";
// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Read and parse a JSON translation file. Returns {} on any error. */
function readTranslationFile(filePath) {
    try {
        const raw = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
/**
 * Resolve all locale JSON files matching the configured localesDir.
 * Returns a map of { locale → absolutePath }.
 */
function resolveLocaleFiles(localesDir, root) {
    const map = new Map();
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
function extractSourceMessages(srcDir) {
    const files = glob.sync(path.join(srcDir, "**/*.{ts,tsx}").replace(/\\/g, "/"));
    const messages = new Set();
    for (const file of files) {
        try {
            const src = fs.readFileSync(file, "utf-8");
            for (const msg of extractMessages(src)) {
                messages.add(msg);
            }
        }
        catch {
            // skip unreadable files
        }
    }
    return [...messages];
}
// ─── Plugin ───────────────────────────────────────────────────────────────────
export default function i18nLabels(options) {
    const { localesDir, sourceLocale = "en", warnOnMissing = true, emitManifest = false, manifestPath = "dist/i18n-manifest.json", } = options;
    let root = process.cwd();
    let srcDir = path.join(root, "src");
    // In-memory cache: locale → compiled JS string
    const cache = new Map();
    /** Compile (or recompile) a single locale and update the cache. */
    function compile(locale, filePath) {
        const translations = readTranslationFile(filePath);
        const sourceMessages = extractSourceMessages(srcDir);
        const { code, stats } = compileLocale(locale, translations, sourceMessages);
        if (warnOnMissing && stats.missing > 0) {
            console.warn(`[i18n] Locale "${locale}": ${stats.missing} missing translation(s) out of ${stats.total}`);
        }
        cache.set(locale, code);
        return code;
    }
    /** Compile all known locale files and populate the cache. */
    function compileAll() {
        const localeFiles = resolveLocaleFiles(localesDir, root);
        for (const [locale, filePath] of localeFiles) {
            compile(locale, filePath);
        }
    }
    return {
        name: "react-i18labels",
        enforce: "pre",
        configResolved(config) {
            root = config.root;
            srcDir = path.join(root, "src");
        },
        buildStart() {
            compileAll();
        },
        // ── Virtual module resolution ─────────────────────────────────────────────
        resolveId(id) {
            if (id.startsWith(VIRTUAL_PREFIX)) {
                return RESOLVED_PREFIX + id.slice(VIRTUAL_PREFIX.length);
            }
        },
        load(id) {
            if (!id.startsWith(RESOLVED_PREFIX))
                return;
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
        configureServer(server) {
            const localeFiles = resolveLocaleFiles(localesDir, root);
            for (const [locale, filePath] of localeFiles) {
                server.watcher.add(filePath);
            }
            server.watcher.on("change", (changedPath) => {
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
            if (!emitManifest)
                return;
            const sourceMessages = extractSourceMessages(srcDir);
            const localeFiles = resolveLocaleFiles(localesDir, root);
            const localeStats = {};
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
//# sourceMappingURL=vite-plugin.js.map