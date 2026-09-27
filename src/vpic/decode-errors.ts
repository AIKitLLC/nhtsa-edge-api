/**
 * Port of vpic.spVinDecode_ErrorCode (docs/vpic-reference/decode-functions.sql):
 * suggests corrections for VIN positions no pattern accepts (codes 2, 3, 4, 5)
 * and reports positions no decoding item used (code 14).
 *
 * The dump version first reads the WMIYearValidChars cache and falls back to
 * fExtractValidCharsPerWmiYear; the cache is derived from the same patterns, so
 * the valid characters are computed from the schemas' precomputed validChars.
 */

import { pgSubstring, validCharsInKey } from "./keys";
import type { DecodingItem, SchemaRecord, WmiRecord } from "./types";
import { vinCheckDigit, vinWmi } from "./vin-functions";

export interface ErrorCodeResult {
  returnCode: string;
  correctedVin: string;
  errorBytes: string;
  unusedPositions: string | null;
}

/** Sort as in the source: '_' first, then by character. */
function sortChars(chars: Iterable<string>): string[] {
  return [...chars].sort((a, b) => {
    if (a === "_" && b !== "_") return -1;
    if (b === "_" && a !== "_") return 1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
}

/** Valid characters per VIN position for the WMI's schemas active in `modelYear`. */
function validCharsForYear(
  wmi: WmiRecord | null,
  schemas: ReadonlyMap<number, SchemaRecord>,
  modelYear: number | null
): Map<number, Set<string>> {
  const byPosition = new Map<number, Set<string>>();
  if (!wmi || modelYear === null) return byPosition;

  for (const [schemaId, yearFrom, yearTo] of wmi.schemas) {
    if (modelYear < yearFrom || modelYear > (yearTo ?? 2999)) continue;
    const schema = schemas.get(schemaId);
    if (!schema) continue;
    for (const [pos, chars] of Object.entries(schema.validChars)) {
      const vinPos = Number(pos) + 3;
      let set = byPosition.get(vinPos);
      if (!set) byPosition.set(vinPos, (set = new Set()));
      for (const c of chars) set.add(c);
    }
  }
  return byPosition;
}

export function spVinDecodeErrorCode(
  rawVin: string,
  modelYear: number | null,
  wmi: WmiRecord | null,
  schemas: ReadonlyMap<number, SchemaRecord>,
  passItems: readonly DecodingItem[]
): ErrorCodeResult {
  const result: ErrorCodeResult = { returnCode: "", correctedVin: "", errorBytes: "", unusedPositions: null };
  const varWmi = vinWmi(rawVin);
  const vin = rawVin.trim();

  if (varWmi.length < 3) {
    result.returnCode += " 6 ";
    return result;
  }

  const valid = validCharsForYear(wmi, schemas, modelYear);

  let corrected = "";
  let replacements = "";
  let cntErrors = 0;
  let lastErrorPos = 0;
  let lastReplacements = "";
  const n = varWmi.length === 6 ? 11 : 14;

  let i = 3;
  while (i < n && i < vin.length) {
    i++;
    const c = vin.charAt(i - 1);
    let r: string;
    if (i === 9 || i === 10) {
      r = c;
    } else {
      const set = valid.get(i);
      if (set && set.size > 0) {
        if (set.has(c)) {
          r = c;
        } else {
          r = "!";
          const x = sortChars(set).join("");
          replacements += `(${i}:${x})`;
          cntErrors++;
          lastErrorPos = i;
          lastReplacements = x;
        }
      } else {
        r = c;
      }
    }
    corrected += r;
  }

  corrected = varWmi.length === 3 ? varWmi + corrected : varWmi.substring(0, 3) + corrected + varWmi.substring(3);
  if (vin.length > corrected.length) {
    corrected += pgSubstring(vin, corrected.length + 1, 3);
  }

  const withChar = (c: string): string =>
    pgSubstring(vin, 1, lastErrorPos - 1) + c + pgSubstring(vin, lastErrorPos + 1, 17 - lastErrorPos);

  if (cntErrors === 1) {
    if (lastReplacements.length === 1) {
      corrected = withChar(lastReplacements);
      result.returnCode += " 2 ";
      result.correctedVin = corrected;
      result.errorBytes = replacements;
    } else {
      let good = 0;
      let newReplacements = "";
      let corrected1 = "";
      for (const c of lastReplacements) {
        const tmpVin = withChar(c);
        if (tmpVin.charAt(8) === vinCheckDigit(tmpVin)) {
          good++;
          newReplacements += c;
          corrected1 = tmpVin;
        }
      }
      if (good === 1) {
        result.returnCode += " 3 ";
        result.correctedVin = corrected1;
        result.errorBytes = `(${lastErrorPos}:${newReplacements})`;
      } else {
        result.returnCode += " 4 ";
        result.correctedVin = corrected;
        result.errorBytes = `(${lastErrorPos}:${lastReplacements})`;
      }
    }
  }

  if (cntErrors > 1) {
    result.returnCode += " 5 ";
    result.correctedVin = corrected;
    result.errorBytes = replacements;
  }

  // Unused positions: characters of positions 4-8 and 11 no pattern item's keys accept
  const used = new Set<string>();
  for (const item of [...passItems].sort((a, b) => a.seq - b.seq)) {
    if (!item.source.toLowerCase().includes("pattern")) continue;
    const key = item.keys ?? "";
    if (key === "") continue;
    for (const [pos, c] of validCharsInKey(key)) {
      if (c !== "|") used.add(`${pos + 3}:${c}`);
    }
  }

  const ubound = Math.min(11, vin.length);
  const unused: number[] = [];
  for (let p = 4; p <= ubound; p++) {
    if (![4, 5, 6, 7, 8, 11].includes(p)) continue;
    if (!used.has(`${p}:${vin.charAt(p - 1)}`)) unused.push(p);
  }

  if (unused.length > 0) {
    result.returnCode += " 14 ";
    result.unusedPositions = unused.join(",");
  }

  return result;
}
