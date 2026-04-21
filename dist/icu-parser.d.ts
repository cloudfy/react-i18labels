/**
 * ICU Message Parser
 *
 * Parses a superset of ICU MessageFormat covering the cases that actually
 * appear in React SPAs:
 *
 *   Plain text          "Hello world"
 *   Interpolation       "Hello, {name}!"
 *   Plural              "You have {count, plural, one {# item} other {# items}}"
 *   Select / gender     "She is {gender, select, male {his} female {her} other {their}} friend"
 *   Nested              "Cart: {count, plural, one {{name} item} other {{name} items}}"
 *
 * The parser returns an AST that the compiler walks to emit a small JS
 * function instead of a plain string.  The runtime calls that function at
 * render time with the interpolation values.
 */
export type TextNode = {
    type: "text";
    value: string;
};
export type ArgNode = {
    type: "arg";
    name: string;
};
export type PluralCase = {
    key: string;
    tokens: ASTNode[];
};
export type PluralNode = {
    type: "plural";
    arg: string;
    offset: number;
    cases: PluralCase[];
};
export type SelectCase = {
    key: string;
    tokens: ASTNode[];
};
export type SelectNode = {
    type: "select";
    arg: string;
    cases: SelectCase[];
};
export type ASTNode = TextNode | ArgNode | PluralNode | SelectNode;
export declare function parseICU(message: string): ASTNode[];
/** Returns true when the AST requires runtime evaluation (plural/select). */
export declare function isComplex(ast: ASTNode[]): boolean;
/** Returns all variable names referenced in an AST (for type generation). */
export declare function collectArgs(ast: ASTNode[]): Set<string>;
//# sourceMappingURL=icu-parser.d.ts.map