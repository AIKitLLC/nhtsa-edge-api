/**
 * Deterministic VIN corpus for parity checks against the live vPIC API.
 * VINs are built from real data: VinException VINs, and VINs assembled from the
 * keys of real Model patterns of each schema (with a valid check digit), plus
 * error-path variants. The live API is the oracle, so realism is not required,
 * only that both sides decode the same string.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validCharsInRegex } from "../../../src/vpic/keys";
import type { SchemaBucket, WmiBucket, WmiRecord } from "../../../src/vpic/types";
import { isCarMpvLightTruck, vinCheckDigit2 } from "../../../src/vpic/vin-functions";
import { readTable } from "./tsv";

export interface CorpusEntry {
  readonly vin: string;
  readonly modelYear?: number;
  readonly kind: string;
}

const VIN_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const DIGITS = "0123456789";
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789"; // 2010..2039 (and 1980..2009)

/** Small seeded PRNG (mulberry32) so the corpus is reproducible. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rand: () => number, list: readonly T[]): T => list[Math.floor(rand() * list.length)] as T;

function yearCode(year: number): string {
  const idx = (((year - 1980) % 30) + 30) % 30;
  return YEAR_CODES.charAt(idx);
}

/** Tokenizes pattern keys into per-position choices ('' = free). */
function keyTokens(keys: string): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const ch = keys.charAt(i);
    if (ch === "[") {
      const end = keys.indexOf("]", i);
      if (end < 0) break;
      tokens.push(validCharsInRegex(keys.substring(i, end + 1)).replace(/[*|]/g, ""));
      i = end;
    } else if (ch === "*") {
      tokens.push("");
    } else if (ch === "#") {
      tokens.push(DIGITS);
    } else {
      tokens.push(ch);
    }
  }
  return tokens;
}

function buildVin(rand: () => number, wmi: WmiRecord, year: number, keys: string | null): string {
  const chars: string[] = new Array(17).fill("");
  const code = wmi.wmi;
  chars[0] = code.charAt(0);
  chars[1] = code.charAt(1);
  chars[2] = code.charAt(2);
  if (code.length === 6) {
    chars[11] = code.charAt(3);
    chars[12] = code.charAt(4);
    chars[13] = code.charAt(5);
  }

  // var_keys positions: 0-4 -> VIN 4-8, 5 -> '|', 6.. -> VIN 10-17
  if (keys) {
    keyTokens(keys).forEach((choices, idx) => {
      if (idx === 5 || choices === "") return; // idx 5 is the '|' at the check-digit position
      const vinIdx = idx + 3;
      if (vinIdx > 16 || chars[vinIdx] !== "") return;
      chars[vinIdx] = pick(rand, [...choices]);
    });
  }

  if (chars[9] === "") chars[9] = yearCode(year);
  if (isCarMpvLightTruck(wmi) && chars[6] === "") {
    chars[6] = year < 2010 ? pick(rand, [...DIGITS]) : pick(rand, [..."ABCDEFGHJKLMNPRSTUVWXYZ"]);
  }
  for (let i = 3; i < 17; i++) {
    if (chars[i] !== "" || i === 8) continue;
    chars[i] = i >= 11 ? pick(rand, [...DIGITS]) : pick(rand, [...VIN_CHARS]);
  }
  chars[8] = "0";
  const draft = chars.join("");
  const cd = vinCheckDigit2(draft, isCarMpvLightTruck(wmi));
  chars[8] = cd === "?" || cd === "" ? "0" : cd;
  return chars.join("");
}

export function buildCorpus(assetsDir: string, dataDir: string, size: number, seed: number, now: Date): CorpusEntry[] {
  const rand = rng(seed);
  const wmiDir = join(assetsDir, "vpic/wmi");
  const wmis: WmiRecord[] = readdirSync(wmiDir)
    .sort()
    .flatMap((f) => Object.values(JSON.parse(readFileSync(join(wmiDir, f), "utf-8")) as WmiBucket))
    .filter((w) => w.schemas.length > 0 && w.wmi.length >= 3)
    .sort((a, b) => a.id - b.id);

  const core = JSON.parse(readFileSync(join(assetsDir, "vpic/core.json"), "utf-8")) as { buckets: { schema: number } };
  const schemaCache = new Map<string, SchemaBucket>();
  const schemaFor = (id: number) => {
    const file = join(assetsDir, `vpic/schema/${id % core.buckets.schema}.json`);
    let bucket = schemaCache.get(file);
    if (!bucket) schemaCache.set(file, (bucket = JSON.parse(readFileSync(file, "utf-8")) as SchemaBucket));
    return bucket.schemas[String(id)];
  };

  const maxYear = now.getUTCFullYear() + 1;
  const out: CorpusEntry[] = [];
  const seen = new Set<string>();
  const push = (e: CorpusEntry) => {
    const key = `${e.vin}|${e.modelYear ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(e);
    }
  };

  // 1. Real VINs listed in vpic.VinException
  const exceptionVins = readTable(dataDir, "vinexception").map((r) => r["vin"] ?? "").filter((v) => v.length === 17);
  for (let i = 0; i < Math.round(size * 0.1); i++) push({ vin: pick(rand, exceptionVins), kind: "vin-exception" });

  // 2. VINs assembled from real Model patterns (and random VDS)
  // Sample WMI-schema links uniformly: manufacturers with many schemas (the major
  // OEMs) are weighted up, instead of the long tail of one-schema trailer makers.
  const links = wmis.flatMap((wmi) => wmi.schemas.map((link) => ({ wmi, link })));
  let guard = 0;
  while (out.length < Math.round(size * 0.8) && guard++ < size * 50) {
    const { wmi, link } = pick(rand, links);
    const [schemaId, yearFrom, yearTo] = link;
    const hi = Math.min(yearTo ?? maxYear, maxYear);
    if (hi < yearFrom) continue;
    const year = yearFrom + Math.floor(rand() * (hi - yearFrom + 1));
    const schema = schemaFor(schemaId);
    if (!schema) continue;
    const models = schema.patterns.filter((p) => p[2] === 28);
    const useModel = models.length > 0 && rand() < 0.85;
    const keys = useModel ? pick(rand, models)[1] : null;
    push({ vin: buildVin(rand, wmi, year, keys), kind: useModel ? "model-pattern" : "random-vds" });
  }

  // 3. Error paths derived from generated VINs
  const base = out.filter((e) => e.kind === "model-pattern");
  guard = 0;
  while (out.length < size && base.length > 0 && guard++ < size * 50) {
    const src = pick(rand, base).vin;
    const variant = Math.floor(rand() * 5);
    if (variant === 0) {
      const wrong = src.charAt(8) === "0" ? "1" : "0";
      push({ vin: `${src.substring(0, 8)}${wrong}${src.substring(9)}`, kind: "bad-check-digit" });
    } else if (variant === 1) {
      push({ vin: src.substring(0, 11), kind: "short-11" });
    } else if (variant === 2) {
      const pos = 3 + Math.floor(rand() * 5);
      push({ vin: `${src.substring(0, pos)}${pick(rand, ["I", "O", "Q"])}${src.substring(pos + 1)}`, kind: "invalid-char" });
    } else if (variant === 3) {
      push({ vin: src, modelYear: 1990 + Math.floor(rand() * 36), kind: "with-model-year" });
    } else {
      const pos = 3 + Math.floor(rand() * 5);
      push({ vin: `${src.substring(0, pos)}${pick(rand, [...VIN_CHARS])}${src.substring(pos + 1)}`, kind: "mutated-vds" });
    }
  }

  return out.slice(0, size);
}
