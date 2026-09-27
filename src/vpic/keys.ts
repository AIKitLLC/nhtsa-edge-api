/**
 * Pattern-key matching, ported from the vPIC dump
 * (docs/vpic-reference/decode-functions.sql):
 *   - spvindecode_core: var_keys and the LIKE / regex match of vpic.Pattern.Keys
 *   - vpic.sqlwild_to_regex
 *   - vpic.fValidCharsInKey / vpic.fValidCharsInRegEx
 */

import { BoundedCache } from "./bounded-cache";

const VALID_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
/** Compiled pattern keys kept per isolate (a decode touches a few hundred). */
const MAX_COMPILED_KEYS = 4096;

/**
 * var_keys = VIN positions 4-8, then '|' and positions 10-17 (check digit skipped).
 */
export function buildVarKeys(vin: string): string {
  let keys = "";
  if (vin.length > 3) {
    keys = vin.substring(3, 8);
    if (vin.length > 9) keys = `${keys}|${vin.substring(9, 17)}`;
  }
  return keys;
}

function escapeRegExpChar(ch: string): string {
  return /[\\^$.*+?()[\]{}|/-]/.test(ch) ? `\\${ch}` : ch;
}

const likeCache = new BoundedCache<string, RegExp>(MAX_COMPILED_KEYS);

/**
 * PostgreSQL `value LIKE pattern` (default escape '\'), anchored on both ends.
 */
export function sqlLike(value: string, pattern: string): boolean {
  let re = likeCache.get(pattern);
  if (!re) {
    let src = "^";
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern.charAt(i);
      if (ch === "\\" && i + 1 < pattern.length) {
        src += escapeRegExpChar(pattern.charAt(++i));
      } else if (ch === "_") {
        src += ".";
      } else if (ch === "%") {
        src += ".*";
      } else {
        src += escapeRegExpChar(ch);
      }
    }
    re = new RegExp(`${src}$`, "s");
    likeCache.set(pattern, re);
  }
  return re.test(value);
}

/**
 * vpic.sqlwild_to_regex: '*' -> '.', '|' escaped, brackets kept, "1-A" collapsed.
 */
export function sqlwildToRegex(pattern: string): string {
  let out = "";
  for (const ch of pattern) {
    if (ch === "*") out += ".";
    else if (ch === "[" || ch === "]") out += ch;
    else if (ch === "|") out += "\\|";
    else if (/[\\.^$+?{}()]/.test(ch)) out += `\\${ch}`;
    else out += ch;
  }
  out = out.split("1-A").join("1A");
  return `^${out}.*`;
}

const regexCache = new BoundedCache<string, RegExp | null>(MAX_COMPILED_KEYS);

function keysRegex(keys: string): RegExp | null {
  if (regexCache.has(keys)) return regexCache.get(keys) ?? null;
  let re: RegExp | null;
  try {
    re = new RegExp(sqlwildToRegex(keys), "s");
  } catch {
    re = null; // pattern PostgreSQL would reject; it can never match
  }
  regexCache.set(keys, re);
  return re;
}

/**
 * Pattern match used when collecting 'Pattern' items:
 *   (keys NOT LIKE '%[%' AND var_keys LIKE replace(keys, '*', '_') || '%')
 *   OR (keys LIKE '%[%' AND var_keys ~ keys_regex)
 */
export function patternKeysMatch(varKeys: string, keys: string): boolean {
  if (!keys.includes("[")) {
    return sqlLike(varKeys, `${keys.split("*").join("_")}%`);
  }
  const re = keysRegex(keys);
  return re !== null && re.test(varKeys);
}

/**
 * Formula patterns: formulaKeys (digits replaced by '#') LIKE replace(keys, '*', '_') || '%'.
 */
export function formulaKeysMatch(formulaKeys: string, keys: string): boolean {
  return sqlLike(formulaKeys, `${keys.split("*").join("_")}%`);
}

export function toFormulaKeys(varKeys: string): string {
  return varKeys.replace(/[0-9]/g, "#");
}

/**
 * The value a formula pattern extracts: var_keys from the first to the last '#' of keys.
 * SUBSTRING(var_keys, STRPOS(keys,'#'), (LENGTH(keys) - STRPOS(REVERSE(keys),'#') + 1) - STRPOS(keys,'#') + 1)
 */
export function formulaValue(varKeys: string, keys: string): string {
  const first = keys.indexOf("#") + 1;
  const last = keys.length - (keys.split("").reverse().join("").indexOf("#") + 1) + 1;
  return pgSubstring(varKeys, first, last - first + 1);
}

/** PostgreSQL SUBSTRING(str, start, count) with 1-based start (may be < 1). */
export function pgSubstring(str: string, start: number, count?: number): string {
  if (count === undefined) return str.substring(Math.max(start, 1) - 1);
  if (count < 0) throw new Error("negative substring length not allowed");
  const end = start + count; // exclusive, 1-based
  const from = Math.max(start, 1);
  if (end <= from) return "";
  return str.substring(from - 1, end - 1);
}

/**
 * vpic.fValidCharsInRegEx(str): characters (from the VIN alphabet) a bracket
 * expression accepts.
 */
export function validCharsInRegex(str: string): string {
  const upper = str.toUpperCase();
  if (!upper.includes("-") && !upper.includes("^")) {
    return upper.split("]").join("").split("[").join("");
  }
  let re: RegExp;
  try {
    re = new RegExp(`^${upper}$`);
  } catch {
    return "";
  }
  let result = "";
  for (const ch of VALID_CHARS) {
    if (re.test(ch)) result += ch;
  }
  return result;
}

/**
 * vpic.fValidCharsInKey(str) with strct = true: (position, character) pairs a key
 * accepts. '*' contributes nothing, '#' contributes every digit, '|' is kept.
 */
export function validCharsInKey(str: string): Array<readonly [number, string]> {
  const out: Array<readonly [number, string]> = [];
  let inside = false;
  let ind = 0;
  let start = 0;

  for (let i = 1; i <= str.length; i++) {
    const s = str.charAt(i - 1);

    if (s === "[" && !inside) {
      inside = true;
      start = i;
      continue;
    }

    if (!inside) {
      ind++;
      if (s === "#") {
        for (const d of "0123456789") out.push([ind, d]);
        continue;
      }
      if (s === "*") continue; // strict mode: wildcard adds no valid character
      out.push([ind, s]);
      continue;
    }

    if (s === "]") {
      ind++;
      const chars = validCharsInRegex(str.substring(start - 1, i));
      for (const c of chars) {
        if (c !== "*" && c !== "|") out.push([ind, c]);
      }
      inside = false;
      start = 0;
    }
  }

  return out;
}
