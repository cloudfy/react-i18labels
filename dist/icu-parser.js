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
function tokenize(input) {
    const tokens = [];
    let i = 0;
    let textBuf = "";
    const flushText = () => {
        if (textBuf) {
            tokens.push({ kind: "text", value: textBuf });
            textBuf = "";
        }
    };
    while (i < input.length) {
        const ch = input[i];
        if (ch === "{") {
            flushText();
            tokens.push({ kind: "open" });
            i++;
        }
        else if (ch === "}") {
            flushText();
            tokens.push({ kind: "close" });
            i++;
        }
        else if (ch === ",") {
            flushText();
            tokens.push({ kind: "comma" });
            i++;
        }
        else if (ch === "#") {
            flushText();
            tokens.push({ kind: "hash" });
            i++;
        }
        else if (ch === "'" && input[i + 1] === "'") {
            textBuf += "'";
            i += 2;
        }
        else if (ch === "'") {
            // ICU quoted literal — consume until closing '
            i++;
            while (i < input.length && input[i] !== "'") {
                textBuf += input[i++];
            }
            i++; // skip closing '
        }
        else {
            // accumulate identifiers / plain text
            const start = i;
            while (i < input.length &&
                input[i] !== "{" &&
                input[i] !== "}" &&
                input[i] !== "," &&
                input[i] !== "#")
                i++;
            const chunk = input.slice(start, i).trim();
            if (chunk) {
                // Decide: is this an ident token (used after { or ,) or plain text?
                // We emit text for now; the parser will re-classify.
                flushText();
                tokens.push({ kind: "ident", value: chunk });
            }
            else {
                textBuf += input.slice(start, i);
                // don't advance — the outer loop will catch the next special char
                if (i === start)
                    i++; // safety: prevent infinite loop on whitespace
            }
        }
    }
    flushText();
    return tokens;
}
// ─── Parser ──────────────────────────────────────────────────────────────────
class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }
    peek() { return this.tokens[this.pos]; }
    consume() { return this.tokens[this.pos++]; }
    expect(kind) {
        const t = this.consume();
        if (t.kind !== kind)
            throw new Error(`ICU parse error: expected ${kind}, got ${t.kind}`);
        return t;
    }
    parseMessage() {
        const nodes = [];
        while (this.pos < this.tokens.length) {
            const t = this.peek();
            if (!t || t.kind === "close")
                break;
            if (t.kind === "text" || t.kind === "ident") {
                this.consume();
                nodes.push({ type: "text", value: t.value });
            }
            else if (t.kind === "hash") {
                this.consume();
                nodes.push({ type: "arg", name: "#" });
            }
            else if (t.kind === "open") {
                nodes.push(this.parseArg());
            }
            else {
                this.consume(); // skip commas / other stray tokens at top level
            }
        }
        return nodes;
    }
    parseArg() {
        this.expect("open");
        const nameToken = this.consume();
        const name = nameToken.value ?? "";
        if (this.peek()?.kind === "close") {
            this.expect("close");
            return { type: "arg", name };
        }
        this.expect("comma");
        const typeToken = this.consume(); // "plural" | "select"
        const typeName = typeToken.value ?? "";
        if (typeName === "plural") {
            return this.parsePlural(name);
        }
        else if (typeName === "select" || typeName === "selectordinal") {
            return this.parseSelect(name);
        }
        // Unknown format type — treat as plain arg and skip to close
        let depth = 1;
        while (this.pos < this.tokens.length && depth > 0) {
            const t = this.consume();
            if (t.kind === "open")
                depth++;
            else if (t.kind === "close")
                depth--;
        }
        return { type: "arg", name };
    }
    parsePlural(arg) {
        // optional "offset:N"
        let offset = 0;
        if (this.peek()?.kind === "comma")
            this.consume();
        if (this.peek()?.kind === "ident" && this.peek().value === "offset") {
            this.consume(); // "offset"
            this.consume(); // ":"  — often merged into the ident
            const n = this.consume();
            offset = parseInt(n.value ?? "0", 10);
            if (this.peek()?.kind === "comma")
                this.consume();
        }
        const cases = this.parseCases();
        return { type: "plural", arg, offset, cases };
    }
    parseSelect(arg) {
        if (this.peek()?.kind === "comma")
            this.consume();
        const cases = this.parseCases();
        return { type: "select", arg, cases };
    }
    parseCases() {
        const cases = [];
        while (this.pos < this.tokens.length) {
            const t = this.peek();
            if (!t || t.kind === "close")
                break;
            if (t.kind !== "ident") {
                this.consume();
                continue;
            }
            const key = this.consume().value;
            this.expect("open");
            const subParser = new Parser(this.sliceUntilClose());
            const tokens = subParser.parseMessage();
            cases.push({ key, tokens });
        }
        this.expect("close"); // closing } of the plural/select
        return cases;
    }
    /**
     * Consume tokens for one plural case body (between inner { and })
     * tracking depth so nested {…} work correctly.
     */
    sliceUntilClose() {
        const slice = [];
        let depth = 1;
        while (this.pos < this.tokens.length) {
            const t = this.tokens[this.pos];
            if (t.kind === "open")
                depth++;
            else if (t.kind === "close") {
                depth--;
                if (depth === 0) {
                    this.pos++;
                    break;
                }
            }
            slice.push(this.tokens[this.pos++]);
        }
        return slice;
    }
}
// ─── Public API ──────────────────────────────────────────────────────────────
export function parseICU(message) {
    // Fast path: no special characters → plain text only
    if (!/[{#']/.test(message))
        return [{ type: "text", value: message }];
    const tokens = tokenize(message);
    const parser = new Parser(tokens);
    return parser.parseMessage();
}
/** Returns true when the AST requires runtime evaluation (plural/select). */
export function isComplex(ast) {
    return ast.some((n) => n.type === "plural" || n.type === "select");
}
/**
 * Detect common ICU format mistakes in a raw message string.
 * Returns a human-readable hint, or null when no known mistake is found.
 */
export function detectCommonMistakes(message) {
    // Double-brace interpolation: {{varName}} — used by i18next/mustache, not ICU
    const doubleBrace = /\{\{([^}]+)\}\}/.exec(message);
    if (doubleBrace) {
        const varName = doubleBrace[1].trim();
        return `Found "{{${varName}}}" — ICU format uses single braces {${varName}}, not double braces. Did you mean "{${varName}}"?`;
    }
    return null;
}
/** Returns all variable names referenced in an AST (for type generation). */
export function collectArgs(ast) {
    const args = new Set();
    function walk(nodes) {
        for (const n of nodes) {
            if (n.type === "arg" && n.name !== "#")
                args.add(n.name);
            if (n.type === "plural") {
                args.add(n.arg);
                n.cases.forEach((c) => walk(c.tokens));
            }
            if (n.type === "select") {
                args.add(n.arg);
                n.cases.forEach((c) => walk(c.tokens));
            }
        }
    }
    walk(ast);
    return args;
}
//# sourceMappingURL=icu-parser.js.map