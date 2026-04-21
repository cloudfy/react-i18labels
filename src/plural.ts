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

const pluralRulesCache = new Map<string, Intl.PluralRules>();

function getPluralRules(locale: string): Intl.PluralRules {
  let pr = pluralRulesCache.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(locale);
    pluralRulesCache.set(locale, pr);
  }
  return pr;
}

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
export function pluralFn(
  value: number,
  locale: string,
  offset: number,
  ...cases: string[]
): string {
  const n = value - offset;
  const display = String(n);

  // Build a lookup map from the flat pairs
  const caseMap: Record<string, string> = {};
  for (let i = 0; i < cases.length - 1; i += 2) {
    caseMap[cases[i]] = cases[i + 1];
  }

  // 1. Exact match (=N) takes highest priority
  const exact = caseMap[`=${n}`];
  if (exact !== undefined) return exact.replace(/#/g, display);

  // 2. Plural category from Intl.PluralRules
  const category = getPluralRules(locale).select(n);
  const byCategory = caseMap[category];
  if (byCategory !== undefined) return byCategory.replace(/#/g, display);

  // 3. Fallback to "other" — always required by ICU spec
  const other = caseMap["other"] ?? display;
  return other.replace(/#/g, display);
}

/**
 * Ordinal plural resolver (for "1st", "2nd", "3rd"…)
 * Uses the same signature as pluralFn but selects ordinal rules.
 */
const ordinalRulesCache = new Map<string, Intl.PluralRules>();

export function ordinalFn(
  value: number,
  locale: string,
  offset: number,
  ...cases: string[]
): string {
  let pr = ordinalRulesCache.get(locale);
  if (!pr) {
    pr = new Intl.PluralRules(locale, { type: "ordinal" });
    ordinalRulesCache.set(locale, pr);
  }

  const n = value - offset;
  const display = String(n);
  const caseMap: Record<string, string> = {};
  for (let i = 0; i < cases.length - 1; i += 2) {
    caseMap[cases[i]] = cases[i + 1];
  }

  const exact = caseMap[`=${n}`];
  if (exact !== undefined) return exact.replace(/#/g, display);

  const category = pr.select(n);
  const byCategory = caseMap[category];
  if (byCategory !== undefined) return byCategory.replace(/#/g, display);

  return (caseMap["other"] ?? display).replace(/#/g, display);
}
