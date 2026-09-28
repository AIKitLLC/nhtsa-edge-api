/**
 * T-SQL `decimal` arithmetic for vpic.Conversion formulas.
 *
 * The public vPIC API runs spVinDecode on SQL Server, which evaluates a formula such
 * as "2.4 / 0.016387064" with SQL Server's decimal typing rules. The PostgreSQL port
 * in the lite dump gives different digits, so the live API is matched instead:
 *   literal  p = significant digits, s = digits after the point
 *   a * b    p = p1 + p2 + 1,               s = s1 + s2
 *   a / b    s = max(6, s1 + p2 + 1),       p = p1 - s1 + s2 + s   (result truncated)
 *   a +/- b  s = max(s1, s2),               p = max(p1 - s1, p2 - s2) + s + 1
 *   p > 38   p = 38 and s = min(s, max(38 - (p - s), 6))
 * Verified against the live API by scripts/vpic/parity.ts
 * (e.g. 2.4 / 0.016387064 -> "146.45698582735").
 */

export interface TsqlDecimal {
  /** value = mantissa / 10^scale */
  readonly mantissa: bigint;
  readonly precision: number;
  readonly scale: number;
}

const MAX_PRECISION = 38;
const MIN_DIV_SCALE = 6;
const pow10 = (n: number): bigint => 10n ** BigInt(n);

export function parseDecimalLiteral(text: string): TsqlDecimal {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || ((match[1] ?? "") === "" && (match[2] ?? "") === "")) {
    throw new Error(`invalid decimal literal: ${text}`);
  }
  const intDigits = (match[1] ?? "").replace(/^0+/, "");
  const frac = match[2] ?? "";
  const scale = frac.length;
  const precision = Math.max(intDigits.length + scale, scale, 1);
  return { mantissa: BigInt(`${intDigits}${frac}` || "0"), precision, scale };
}

/** Divides and truncates toward zero. */
function truncDiv(a: bigint, b: bigint): bigint {
  return a / b; // BigInt division truncates toward zero
}

/** Divides and rounds half away from zero. */
function roundDiv(a: bigint, b: bigint): bigint {
  const negative = a < 0n !== b < 0n;
  const absA = a < 0n ? -a : a;
  const absB = b < 0n ? -b : b;
  let q = absA / absB;
  if ((absA % absB) * 2n >= absB) q += 1n;
  return negative ? -q : q;
}

function fitPrecision(p: number, s: number): { p: number; s: number } {
  if (p <= MAX_PRECISION) return { p, s };
  const integral = p - s;
  return { p: MAX_PRECISION, s: Math.min(s, Math.max(MAX_PRECISION - integral, MIN_DIV_SCALE)) };
}

function withScale(mantissa: bigint, from: number, to: number, round: boolean): bigint {
  if (to >= from) return mantissa * pow10(to - from);
  const divisor = pow10(from - to);
  return round ? roundDiv(mantissa, divisor) : truncDiv(mantissa, divisor);
}

export function add(a: TsqlDecimal, b: TsqlDecimal, subtract = false): TsqlDecimal {
  const s0 = Math.max(a.scale, b.scale);
  const p0 = Math.max(a.precision - a.scale, b.precision - b.scale) + s0 + 1;
  const { p, s } = fitPrecision(p0, s0);
  const sum = a.mantissa * pow10(s0 - a.scale) + (subtract ? -1n : 1n) * b.mantissa * pow10(s0 - b.scale);
  return { mantissa: withScale(sum, s0, s, true), precision: p, scale: s };
}

export function mul(a: TsqlDecimal, b: TsqlDecimal): TsqlDecimal {
  const s0 = a.scale + b.scale;
  const { p, s } = fitPrecision(a.precision + b.precision + 1, s0);
  return { mantissa: withScale(a.mantissa * b.mantissa, s0, s, true), precision: p, scale: s };
}

export function div(a: TsqlDecimal, b: TsqlDecimal): TsqlDecimal {
  if (b.mantissa === 0n) throw new Error("Divide by zero error encountered.");
  const s0 = Math.max(MIN_DIV_SCALE, a.scale + b.precision + 1);
  const { p, s } = fitPrecision(a.precision - a.scale + b.scale + s0, s0);
  // a/b * 10^s = a.m * 10^(s + b.s - a.s) / b.m
  const shift = s + b.scale - a.scale;
  const numerator = shift >= 0 ? a.mantissa * pow10(shift) : a.mantissa;
  const denominator = shift >= 0 ? b.mantissa : b.mantissa * pow10(-shift);
  return { mantissa: truncDiv(numerator, denominator), precision: p, scale: s };
}

export function negate(a: TsqlDecimal): TsqlDecimal {
  return { ...a, mantissa: -a.mantissa };
}

/** CAST(decimal AS varchar): all scale digits, leading "0." for |x| < 1. */
export function decimalToString(d: TsqlDecimal): string {
  const negative = d.mantissa < 0n;
  const digits = (negative ? -d.mantissa : d.mantissa).toString().padStart(d.scale + 1, "0");
  const intPart = digits.substring(0, digits.length - d.scale);
  const frac = digits.substring(digits.length - d.scale);
  const text = d.scale > 0 ? `${intPart}.${frac}` : intPart;
  return negative && d.mantissa !== 0n ? `-${text}` : text;
}

type Token = { kind: "num"; value: TsqlDecimal } | { kind: "op"; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+\.?\d*|\.\d+)|([-+*/()]))/y;
  let pos = 0;
  while (pos < expr.length) {
    if (/^\s*$/.test(expr.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(expr);
    if (!m) throw new Error(`unexpected input at ${pos}: ${expr}`);
    if (m[1] !== undefined) tokens.push({ kind: "num", value: parseDecimalLiteral(m[1]) });
    else if (m[2] !== undefined) tokens.push({ kind: "op", value: m[2] });
    pos = re.lastIndex;
  }
  return tokens;
}

/**
 * Evaluates + - * / and parentheses over decimal literals, the only shapes
 * vpic.Conversion formulas take once '#x#' is substituted. Throws otherwise
 * (the decoder then stores '0', as the source does on any SQL error).
 */
export function evaluateDecimalExpression(expr: string): string {
  const tokens = tokenize(expr);
  let i = 0;
  const peek = (): Token | undefined => tokens[i];
  const next = (): Token | undefined => tokens[i++];

  function primary(): TsqlDecimal {
    const t = next();
    if (!t) throw new Error("unexpected end of expression");
    if (t.kind === "num") return t.value;
    if (t.value === "(") {
      const v = expression();
      const close = next();
      if (!close || close.kind !== "op" || close.value !== ")") throw new Error("missing ')'");
      return v;
    }
    if (t.value === "-") return negate(primary());
    if (t.value === "+") return primary();
    throw new Error(`unexpected operator ${t.value}`);
  }

  function term(): TsqlDecimal {
    let left = primary();
    for (let t = peek(); t && t.kind === "op" && (t.value === "*" || t.value === "/"); t = peek()) {
      i++;
      const right = primary();
      left = t.value === "*" ? mul(left, right) : div(left, right);
    }
    return left;
  }

  function expression(): TsqlDecimal {
    let left = term();
    for (let t = peek(); t && t.kind === "op" && (t.value === "+" || t.value === "-"); t = peek()) {
      i++;
      const right = term();
      left = add(left, right, t.value === "-");
    }
    return left;
  }

  const result = expression();
  if (i !== tokens.length) throw new Error("trailing input");
  return decimalToString(result);
}
