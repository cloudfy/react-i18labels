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
export type CompiledEntry = {
    kind: "string";
    value: string;
} | {
    kind: "fn";
    body: string;
    args: string[];
};
/**
 * Compile a single ICU message string for a given locale.
 * Returns either a plain string (no-op at runtime) or a function body
 * string that the locale module will export as an arrow function.
 */
export declare function compileMessage(message: string, locale: string): CompiledEntry;
export interface TranslationInput {
    [sourceText: string]: string;
}
export interface CompiledLocaleModule {
    locale: string;
    /** The JS source code of the locale module. */
    code: string;
    /** Stats for the compiler report. */
    stats: {
        total: number;
        plain: number;
        interpolated: number;
        complex: number;
        missing: number;
    };
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
export declare function compileLocale(locale: string, translations: TranslationInput, sourceMessages: string[]): CompiledLocaleModule;
/**
 * Given source TypeScript/TSX content, extract all strings passed to t() or
 * used as children of <T>.  This is a lightweight regex pass — the Vite
 * plugin uses ts-morph for full AST extraction, but this covers 95 % of
 * real-world patterns for a standalone CLI.
 */
export declare function extractMessages(source: string): string[];
//# sourceMappingURL=icu-codegen.d.ts.map