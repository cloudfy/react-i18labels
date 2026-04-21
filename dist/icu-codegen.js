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
import { collectArgs, isComplex, parseICU } from "./icu-parser.js";
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
    const ast = parseICU(message);
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
        const compiled = compileMessage(translated, locale);
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
 */
export function extractMessages(source) {
    const messages = new Set();
    // t('...') and t("...") — including template tag t`...`
    const tCallRe = /\bt\(\s*(['"`])((?:(?!\1).|\\.)*)\1/g;
    let m;
    while ((m = tCallRe.exec(source)) !== null) {
        messages.add(m[2].replace(/\\'/g, "'").replace(/\\"/g, '"'));
    }
    // <T>...</T> — captures simple text children (no JSX inside)
    const tJsxRe = /<T(?:\s[^>]*)?>([^<{]+)<\/T>/g;
    while ((m = tJsxRe.exec(source)) !== null) {
        messages.add(m[1].trim());
    }
    return [...messages].filter(Boolean);
}
//# sourceMappingURL=icu-codegen.js.map