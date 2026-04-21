/**
 * Runtime plural resolver
 *
 * This is the ONLY ICU-related code that ships to the browser (~400 bytes
 * minified + gzipped).  Everything else — parsing, AST walking, code
 * generation — stays in the build-time compiler.
 *
 * The compiled locale modules emit calls like:
 *
 *   _pf(v.count, "da", 0, "one", "# element", "other", "# elementer")
 *
 * This function:
 *   1. Subtracts offset from value
 *   2. Asks Intl.PluralRules which category applies (one/few/many/other/…)
 *   3. Falls back through: exact-match → plural-category → "other"
 *   4. Replaces # with the display number
 *
 * Intl.PluralRules instances are cached per locale so repeated calls within
 * one render cycle are O(1) after the first.
 */
/**
 * Resolve a plural expression at runtime.
 *
 * @param value    The raw numeric value (e.g. v.count)
 * @param locale   Active locale string (e.g. "da", "ar", "ru")
 * @param offset   ICU offset (almost always 0)
 * @param cases    Flat pairs: key₁, template₁, key₂, template₂, …
 *
 * Case keys may be:
 *   - ICU categories:  "zero" | "one" | "two" | "few" | "many" | "other"
 *   - Exact values:    "=0" | "=1" | "=42"
 */
export declare function pluralFn(value: number, locale: string, offset: number, ...cases: string[]): string;
export declare function ordinalFn(value: number, locale: string, offset: number, ...cases: string[]): string;
//# sourceMappingURL=plural.d.ts.map