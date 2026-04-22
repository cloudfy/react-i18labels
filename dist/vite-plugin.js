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
import { compileLocale, extractMessages } from "./icu-codegen.js";
// ─── Constants ────────────────────────────────────────────────────────────────
const VIRTUAL_PREFIX = "virtual:i18n/";
const RESOLVED_PREFIX = "\0virtual:i18n/";
const LOADER_VIRTUAL = "virtual:i18n/loader";
const LOADER_RESOLVED = "\0virtual:i18n/loader";
// ─── Helpers ──────────────────────────────────────────────────────────────────
/**
 * Generate a loader module with one static import per locale.
 * Vite can rewrite static `import("virtual:i18n/...")` calls correctly;
 * template-literal dynamic imports resolve to a bare URL which the browser
 * cannot fetch (CorsDisabledScheme).  This module is the fix.
 */
function generateLoaderCode(localeFiles) {
    const entries = [...localeFiles.keys()]
        .map((l) => `  ${JSON.stringify(l)}: () => import("virtual:i18n/${l}")`)
        .join(",\n");
    return [
        `const _locales = {`,
        entries,
        `};`,
        `export default function loadLocale(locale) {`,
        `  const loader = _locales[locale];`,
        `  if (!loader) {`,
        `    console.warn('[i18n] No locale module for "' + locale + '"');`,
        `    return Promise.resolve({ default: {} });`,
        `  }`,
        `  return loader();`,
        `}`,
    ].join("\n");
}
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
function extractSourceMessages(srcDir, sep) {
    const files = glob.sync(path.join(srcDir, "**/*.{ts,tsx}").replace(/\\/g, "/"));
    const messages = new Set();
    for (const file of files) {
        try {
            const src = fs.readFileSync(file, "utf-8");
            for (const msg of extractMessages(src, sep)) {
                messages.add(msg);
            }
        }
        catch {
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
function syncLocaleFiles(sourceMessages, localeFiles, mode, root, onError, onInfo) {
    const allMissing = [];
    for (const [locale, filePath] of localeFiles) {
        const existing = readTranslationFile(filePath);
        const missingKeys = sourceMessages.filter((m) => !(m in existing));
        if (missingKeys.length === 0)
            continue;
        allMissing.push({ locale, keys: missingKeys });
        if (mode === "update") {
            const updated = { ...existing };
            for (const key of missingKeys) {
                updated[key] = ""; // empty string flags it as needing translation
            }
            fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + "\n", "utf-8");
            onInfo(`[i18n] "${locale}": added ${missingKeys.length} missing key(s) → ${path.relative(root, filePath)}`);
        }
    }
    if (mode === "check" && allMissing.length > 0) {
        const detail = allMissing
            .map(({ locale, keys }) => `  Locale "${locale}" — ${keys.length} missing key(s):\n` +
            keys.map((k) => `    • ${JSON.stringify(k)}`).join("\n"))
            .join("\n");
        onError(`[i18n] Translation sync failed. Run the build with syncLocales: "update" to fix automatically.\n${detail}`);
    }
}
// ─── Bootstrap helper ───────────────────────────────────────────────────────
/**
 * Ensure the locales directory and any declared locale JSON stubs exist on
 * disk.  Safe to call unconditionally — directory creation is a no-op when the
 * folder already exists, and file creation is skipped for locales that already
 * have a JSON file.
 */
function ensureLocalesDir(absLocalesDir, declaredLocales, root) {
    if (!fs.existsSync(absLocalesDir)) {
        fs.mkdirSync(absLocalesDir, { recursive: true });
        console.info(`[i18n] Created ${path.relative(root, absLocalesDir)}/`);
    }
    if (!declaredLocales?.length)
        return;
    // RFC 5646-ish: allow letters, digits, and hyphens only (e.g. "en", "zh-Hans", "pt-BR").
    const SAFE_LOCALE = /^[A-Za-z0-9-]+$/;
    for (const locale of declaredLocales) {
        if (!SAFE_LOCALE.test(locale)) {
            throw new Error(`[i18n] Unsafe locale code "${locale}". Locale codes must match /^[A-Za-z0-9-]+$/.`);
        }
        const filePath = path.join(absLocalesDir, `${locale}.json`);
        // Guard against path traversal even if the regex were somehow bypassed.
        // path.relative() is robust across platforms: if the file escapes the
        // directory the result starts with ".." or is an absolute path.
        const rel = path.relative(path.resolve(absLocalesDir), path.resolve(filePath));
        if (rel.startsWith("..") || path.isAbsolute(rel)) {
            throw new Error(`[i18n] Resolved locale path "${filePath}" escapes the locales directory.`);
        }
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, "{}\n", "utf-8");
            console.info(`[i18n] Created ${path.relative(root, filePath)}`);
        }
    }
}
// ─── Plugin ───────────────────────────────────────────────────────────────────
export default function i18nLabels(options) {
    const { localesDir, sourceLocale = "en", warnOnMissing = true, emitManifest = false, manifestPath = "dist/i18n-manifest.json", syncLocales = false, locales: declaredLocales, namespaceSeparator = "-", } = options;
    let root = process.cwd();
    let srcDir = path.join(root, "src");
    // In-memory cache: locale → compiled JS string
    const cache = new Map();
    /** Compile (or recompile) a single locale and update the cache. */
    function compile(locale, filePath) {
        const translations = readTranslationFile(filePath);
        const sourceMessages = extractSourceMessages(srcDir, namespaceSeparator);
        let code;
        let stats;
        try {
            ({ code, stats } = compileLocale(locale, translations, sourceMessages));
        }
        catch (err) {
            const rel = path.relative(root, filePath).replace(/\\/g, "/");
            throw new Error(`[i18n] Translation compile error in ${rel}\n  ` +
                err.message.replace(/\n/g, "\n  "));
        }
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
            // Derive the concrete directory from localesDir, which may be a plain
            // directory ("./locales"), a glob ("./src/locales/*.json"), or a direct
            // JSON path ("./locales/en.json").  Normalize using the same logic as
            // resolveLocaleFiles, then strip the filename with path.dirname so we
            // never pass a glob pattern or a .json filename to fs.mkdirSync.
            const normalizedPattern = localesDir.endsWith(".json")
                ? localesDir
                : path.join(localesDir, "*.json");
            const absPattern = path.isAbsolute(normalizedPattern)
                ? normalizedPattern
                : path.join(root, normalizedPattern);
            const absLocalesDir = path.dirname(absPattern);
            // Only bootstrap the locales directory and declared locale stubs when
            // running in update mode, since this may create files on disk.
            if (syncLocales === "update") {
                ensureLocalesDir(absLocalesDir, declaredLocales, root);
            }
            if (syncLocales) {
                const sourceMessages = extractSourceMessages(srcDir, namespaceSeparator);
                const localeFiles = resolveLocaleFiles(localesDir, root);
                syncLocaleFiles(sourceMessages, localeFiles, syncLocales, root, (msg) => { throw new Error(msg); }, (msg) => console.info(msg));
            }
            compileAll();
        },
        // ── Virtual module resolution ─────────────────────────────────────────────
        resolveId(id) {
            if (id === LOADER_VIRTUAL)
                return LOADER_RESOLVED;
            if (id.startsWith(VIRTUAL_PREFIX)) {
                return RESOLVED_PREFIX + id.slice(VIRTUAL_PREFIX.length);
            }
        },
        load(id) {
            if (id === LOADER_RESOLVED) {
                const localeFiles = resolveLocaleFiles(localesDir, root);
                return generateLoaderCode(localeFiles);
            }
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
                console.warn(`[i18n] No translation file found for locale "${locale}"`);
                return `export default {};`;
            }
            return compile(locale, filePath);
        },
        // ── HMR: watch translation JSON files ────────────────────────────────────
        configureServer(server) {
            const localeFiles = resolveLocaleFiles(localesDir, root);
            // Watch locale JSON files
            for (const [, filePath] of localeFiles) {
                server.watcher.add(filePath);
            }
            // Watch source TS/TSX files so new t() calls sync immediately in dev
            if (syncLocales === "update") {
                server.watcher.add(path.join(srcDir, "**/*.{ts,tsx}"));
            }
            server.watcher.on("change", (changedPath) => {
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
                            const loaderMod = server.moduleGraph.getModuleById(LOADER_RESOLVED);
                            if (loaderMod)
                                server.moduleGraph.invalidateModule(loaderMod);
                            server.hot.send({ type: "full-reload" });
                        }
                        return;
                    }
                }
                // ── A source file changed — sync new keys then recompile ─────────────
                if (syncLocales === "update" && /\.(tsx?)$/.test(changedPath)) {
                    const sourceMessages = extractSourceMessages(srcDir, namespaceSeparator);
                    syncLocaleFiles(sourceMessages, currentLocaleFiles, "update", root, (msg) => console.error(msg), (msg) => console.info(msg));
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
            if (!emitManifest)
                return;
            const sourceMessages = extractSourceMessages(srcDir, namespaceSeparator);
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