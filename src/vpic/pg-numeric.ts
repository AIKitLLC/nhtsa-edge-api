/**
 * Minimal PostgreSQL `numeric` arithmetic for vpic.Conversion formulas, which the
 * decoder evaluates as `select (<formula>)::varchar(500)`.
 *
 * Reproduces PostgreSQL's result scales (add/sub: max scale, mul: sum of scales,
 * div: select_div_scale with 16 significant digits) and its text output, so that
 * converted values (e.g. DisplacementL from DisplacementCC) match byte for byte.
 */

export interface PgNumeric {
  /** value = mantissa / 10^scale */
  readonly mantissa: bigint;
  readonly scale: number;
}

const NUMERIC_MIN_SIG_DIGITS = 16;
const DEC_DIGITS = 4;
const NUMERIC_MAX_DISPLAY_SCALE = 1000;

const pow10 = (n: number): bigint => 10n ** BigInt(n);

export function parseNumericLiteral(text: string): PgNumeric {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[1] === "" && (match[2] ?? "") === "")) {
    throw new Error(`invalid numeric literal: ${text}`);
  }
  const intPart = match[1] ?? "";
  const frac = match[2] ?? "";
  return { mantissa: BigInt(`${intPart}${frac}` || "0"), scale: frac.length };
}

function rescale(n: PgNumeric, scale: number): bigint {
  return n.mantissa * pow10(scale - n.scale);
}

export function add(a: PgNumeric, b: PgNumeric): PgNumeric {
  const scale = Math.max(a.scale, b.scale);
  return { mantissa: rescale(a, scale) + rescale(b, scale), scale };
}

export function sub(a: PgNumeric, b: PgNumeric): PgNumeric {
  const scale = Math.max(a.scale, b.scale);
  return { mantissa: rescale(a, scale) - rescale(b, scale), scale };
}

export function mul(a: PgNumeric, b: PgNumeric): PgNumeric {
  return { mantissa: a.mantissa * b.mantissa, scale: a.scale + b.scale };
}

export function neg(a: PgNumeric): PgNumeric {
  return { mantissa: -a.mantissa, scale: a.scale };
}

/**
 * Weight and first digit of the base-10000 representation PostgreSQL stores,
 * as used by select_div_scale().
 */
function nbaseWeight(n: PgNumeric): { weight: number; firstDigit: number } {
  const abs = n.mantissa < 0n ? -n.mantissa : n.mantissa;
  if (abs === 0n) return { weight: 0, firstDigit: 0 };

  const digits = abs.toString();
  const intLen = digits.length - n.scale; // may be <= 0
  if (intLen > 0) {
    const weight = Math.floor((intLen - 1) / DEC_DIGITS);
    const firstGroupLen = intLen - weight * DEC_DIGITS;
    return { weight, firstDigit: Number(digits.substring(0, firstGroupLen)) };
  }

  // Pure fraction: pad to the full fraction, then walk base-10000 groups
  const fraction = digits.padStart(n.scale, "0");
  for (let g = 0; g * DEC_DIGITS < fraction.length; g++) {
    const group = Number(fraction.substring(g * DEC_DIGITS, g * DEC_DIGITS + DEC_DIGITS).padEnd(DEC_DIGITS, "0"));
    if (group !== 0) return { weight: -(g + 1), firstDigit: group };
  }
  return { weight: 0, firstDigit: 0 };
}

function selectDivScale(a: PgNumeric, b: PgNumeric): number {
  const w1 = nbaseWeight(a);
  const w2 = nbaseWeight(b);
  let qweight = w1.weight - w2.weight;
  if (w1.firstDigit <= w2.firstDigit) qweight--;
  let rscale = NUMERIC_MIN_SIG_DIGITS - qweight * DEC_DIGITS;
  rscale = Math.max(rscale, a.scale, b.scale, 0);
  return Math.min(rscale, NUMERIC_MAX_DISPLAY_SCALE);
}

/** Division rounded half away from zero to PostgreSQL's chosen scale. */
export function div(a: PgNumeric, b: PgNumeric): PgNumeric {
  if (b.mantissa === 0n) throw new Error("division by zero");
  const scale = selectDivScale(a, b);
  // a/b * 10^scale = a.m * 10^(scale + b.scale) / (b.m * 10^a.scale)
  const numerator = a.mantissa * pow10(scale + b.scale);
  const denominator = b.mantissa * pow10(a.scale);
  const negative = numerator < 0n !== denominator < 0n;
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;
  let q = absNum / absDen;
  if ((absNum % absDen) * 2n >= absDen) q += 1n;
  return { mantissa: negative ? -q : q, scale };
}

export function numericToString(n: PgNumeric): string {
  const negative = n.mantissa < 0n;
  const digits = (negative ? -n.mantissa : n.mantissa).toString().padStart(n.scale + 1, "0");
  const intPart = digits.substring(0, digits.length - n.scale);
  const frac = digits.substring(digits.length - n.scale);
  const text = n.scale > 0 ? `${intPart}.${frac}` : intPart;
  return negative && n.mantissa !== 0n ? `-${text}` : text;
}

type Token = { kind: "num"; value: PgNumeric } | { kind: "op"; value: string };

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  const re = /\s*(?:(\d+\.?\d*|\.\d+)|([-+*/()]))/y;
  let pos = 0;
  while (pos < expr.length) {
    if (/^\s*$/.test(expr.slice(pos))) break;
    re.lastIndex = pos;
    const m = re.exec(expr);
    if (!m) throw new Error(`unexpected input at ${pos}: ${expr}`);
    if (m[1] !== undefined) tokens.push({ kind: "num", value: parseNumericLiteral(m[1]) });
    else if (m[2] !== undefined) tokens.push({ kind: "op", value: m[2] });
    pos = re.lastIndex;
  }
  return tokens;
}

/**
 * Evaluates an arithmetic expression of numeric literals with + - * / and parentheses,
 * the only shapes vpic.Conversion formulas take once '#x#' is substituted.
 * Throws on anything else (the source then stores '0').
 */
export function evaluateNumericExpression(expr: string): string {
  const tokens = tokenize(expr);
  let i = 0;

  const peek = (): Token | undefined => tokens[i];
  const next = (): Token | undefined => tokens[i++];

  function primary(): PgNumeric {
    const t = next();
    if (!t) throw new Error("unexpected end of expression");
    if (t.kind === "num") return t.value;
    if (t.value === "(") {
      const v = expression();
      const close = next();
      if (!close || close.kind !== "op" || close.value !== ")") throw new Error("missing ')'");
      return v;
    }
    if (t.value === "-") return neg(primary());
    if (t.value === "+") return primary();
    throw new Error(`unexpected operator ${t.value}`);
  }

  function term(): PgNumeric {
    let left = primary();
    for (let t = peek(); t && t.kind === "op" && (t.value === "*" || t.value === "/"); t = peek()) {
      i++;
      const right = primary();
      left = t.value === "*" ? mul(left, right) : div(left, right);
    }
    return left;
  }

  function expression(): PgNumeric {
    let left = term();
    for (let t = peek(); t && t.kind === "op" && (t.value === "+" || t.value === "-"); t = peek()) {
      i++;
      const right = term();
      left = t.value === "+" ? add(left, right) : sub(left, right);
    }
    return left;
  }

  const result = expression();
  if (i !== tokens.length) throw new Error("trailing input");
  return numericToString(result);
}
