/**
 * ICU Code Generator
 *
 * Walks the AST produced by icu-parser and emits a compact JavaScript
 * function body string.  The compiler writes this into the compiled locale
 * module so no ICU parser ships to the browser.
 *
 * Output shapes:
 *
 *   Plain string  →  "Hello world"          (raw string, no function)
 *   Interpolation →  (v)=>`Hello, ${v.name}!`
 *   Plural        →  (v,pf)=>`You have ${pf(v.count,'en',0,'one','item','other',`${v.count} items`)}`
 *
 * The runtime receives either a string or a function and calls it with
 * (values, pluralFn).  The pluralFn is the only runtime dependency — it
 * wraps Intl.PluralRules, cached per locale.
 *
 * This keeps the compiled locale modules ~pure data with tiny inline logic.
 */
import { collectArgs, detectCommonMistakes, isComplex, parseICU } from "./icu-parser.js";
// ─── AST → JS string ─────────────────────────────────────────────────────────
function emitNodes(nodes, locale) {
    return nodes.map((n) => emitNode(n, locale)).join("");
}
function emitNode(node, locale) {
    switch (node.type) {
        case "text":
            return node.value;
        case "arg":
            if (node.name === "#")
                return "${_n}"; // # inside plural → current number
            return `\${v.${node.name}}`;
        case "plural":
            return emitPlural(node, locale);
        case "select":
            return emitSelect(node, locale);
    }
}
function emitPlural(node, locale) {
    // Build flat args: locale, offset, then pairs of (key, template)
    const offsetStr = node.offset !== 0 ? `,${node.offset}` : ",0";
    const casePairs = node.cases
        .map((c) => {
        const body = emitNodes(c.tokens, locale);
        // Replace # with actual number expression
        const bodyWithN = body.replace(/\$\{_n\}/g, `\${v.${node.arg}-${node.offset}}`);
        return `"${c.key}",\`${bodyWithN}\``;
    })
        .join(",");
    // _pf = plural function injected by runtime
    // signature: _pf(value, locale, offset, ...casePairs) → string
    return `\${_pf(v.${node.arg},"${locale}"${offsetStr},${casePairs})}`;
}
function emitSelect(node, locale) {
    // Select is simpler — no offset, no plural rules, just key matching
    // We emit an IIFE that does a switch on the value
    const cases = node.cases
        .map((c) => `case "${c.key}":return\`${emitNodes(c.tokens, locale)}\`;`)
        .join("");
    return `\${((v)=>{switch(v.${node.arg}){${cases}default:return""}})(v)}`;
}
/**
 * Compile a single ICU message string for a given locale.
 * Returns either a plain string (no-op at runtime) or a function body
 * string that the locale module will export as an arrow function.
 */
export function compileMessage(message, locale) {
    let ast;
    try {
        ast = parseICU(message);
    }
    catch (err) {
        const hint = detectCommonMistakes(message);
        const truncated = message.length > 80 ? message.slice(0, 80) + "…" : message;
        const lines = [
            `ICU parse error in value: ${err.message}`,
            `  Value: ${JSON.stringify(truncated)}`,
        ];
        if (hint)
            lines.push(`  Hint:  ${hint}`);
        throw new Error(lines.join("\n"));
    }
    const args = [...collectArgs(ast)];
    if (!isComplex(ast) && args.length === 0) {
        // Pure text — no function needed
        return { kind: "string", value: message };
    }
    if (!isComplex(ast) && args.length > 0) {
        // Simple interpolation — template literal, no plural function
        const body = emitNodes(ast, locale);
        return { kind: "fn", body: `(v)=>\`${body}\``, args };
    }
    // Complex (plural / select) — needs _pf injected by runtime
    const body = emitNodes(ast, locale);
    return { kind: "fn", body: `(v,_pf)=>\`${body}\``, args };
}
/**
 * Compile an entire locale's translation map into a JS module string.
 *
 * The emitted module looks like:
 *
 *   export default {
 *     "Settings": "Indstillinger",
 *     "Hello, {name}!": (v)=>`Hej, ${v.name}!`,
 *     "You have {count, plural, one {# item} other {# items}}":
 *       (v,_pf)=>`Du har ${_pf(v.count,"da",0,"one","# element","other","# elementer")}`,
 *   };
 */
export function compileLocale(locale, translations, sourceMessages) {
    const stats = { total: 0, plain: 0, interpolated: 0, complex: 0, missing: 0 };
    const entries = [];
    for (const source of sourceMessages) {
        stats.total++;
        const translated = translations[source];
        if (!translated) {
            stats.missing++;
            // Emit the source text as-is (graceful fallback)
            entries.push(`  ${JSON.stringify(source)}: ${JSON.stringify(source)}`);
            continue;
        }
        let compiled;
        try {
            compiled = compileMessage(translated, locale);
        }
        catch (err) {
            const truncKey = source.length > 60 ? source.slice(0, 60) + "…" : source;
            const truncVal = translated.length > 60 ? translated.slice(0, 60) + "…" : translated;
            throw new Error(`[i18n] Locale "${locale}" — failed to compile translation:\n` +
                `  Key:   ${JSON.stringify(truncKey)}\n` +
                `  Value: ${JSON.stringify(truncVal)}\n` +
                `  ${err.message.replace(/\n/g, "\n  ")}`);
        }
        if (compiled.kind === "string") {
            stats.plain++;
            entries.push(`  ${JSON.stringify(source)}: ${JSON.stringify(compiled.value)}`);
        }
        else {
            const ast = parseICU(translated);
            if (isComplex(ast)) {
                stats.complex++;
            }
            else {
                stats.interpolated++;
            }
            entries.push(`  ${JSON.stringify(source)}: ${compiled.body}`);
        }
    }
    const code = [
        `// @generated — do not edit. Run \`i18n compile\` to regenerate.`,
        `// Locale: ${locale}  |  Total: ${stats.total}  |  Missing: ${stats.missing}`,
        `export default {`,
        entries.join(",\n"),
        `};`,
    ].join("\n");
    return { locale, code, stats };
}
// ─── Source locale: extract all unique message strings ───────────────────────
/**
 * Given source TypeScript/TSX content, extract all strings passed to t() or
 * used as children of <T>.  This is a lightweight regex pass — the Vite
 * plugin uses ts-morph for full AST extraction, but this covers 95 % of
 * real-world patterns for a standalone CLI.
 *
 * When a `useTranslation("namespace")` call precedes a `t("key")` call (or a
 * subsequent `useTranslation()` / `useTranslation(undefined)` resets it), the
 * extracted key is prefixed: `namespace{sep}key`.  Likewise, `<T ns="ns">`
 * emits a prefixed key.  The separator defaults to `"-"`.
 */
export function extractMessages(source, sep = "-") {
    const messages = new Set();
    // Pass 1: collect useTranslation namespace declarations in source order.
    // A call with no argument (or `undefined`) clears the active namespace.
    const nsDeclarations = [];
    const useTranslationRe = /\buseTranslation\s*\(\s*(?:undefined\b\s*|(['"`])((?:(?!\1).|\\.)*)\1\s*)?\)/g;
    let m;
    while ((m = useTranslationRe.exec(source)) !== null) {
        const namespace = m[2] != null ? m[2].replace(/\\'/g, "'").replace(/\\"/g, '"') : null;
        nsDeclarations.push({ offset: m.index, namespace });
    }
    /** Return the active namespace for a given character offset. */
    function nsForOffset(offset) {
        let best = null;
        for (const decl of nsDeclarations) {
            if (decl.offset < offset)
                best = decl.namespace;
            else
                break;
        }
        return best;
    }
    // Pass 2: t('...') and t("...") — including template tag t`...`
    const tCallRe = /\bt\(\s*(['"`])((?:(?!\1).|\\.)*)\1/g;
    while ((m = tCallRe.exec(source)) !== null) {
        const raw = m[2].replace(/\\'/g, "'").replace(/\\"/g, '"');
        const ns = nsForOffset(m.index);
        messages.add(ns ? `${ns}${sep}${raw}` : raw);
    }
    // Pass 3: <T> JSX — captures attributes (m[1]) and simple text child (m[2]).
    // Handles <T>text</T> and <T ns="admin">text</T>.
    const tJsxRe = /<T(\s[^>]*)?>([^<{]+)<\/T>/g;
    while ((m = tJsxRe.exec(source)) !== null) {
        const text = m[2].trim();
        if (!text)
            continue;
        const attrs = m[1] ?? "";
        const nsMatch = attrs.match(/\bns=["']([^"']+)["']/);
        messages.add(nsMatch ? `${nsMatch[1]}${sep}${text}` : text);
    }
    return [...messages].filter(Boolean);
}
//# sourceMappingURL=icu-codegen.js.map