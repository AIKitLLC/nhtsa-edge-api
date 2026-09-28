#!/usr/bin/env bun
/**
 * Function-level differential test: each ported helper vs the verbatim NHTSA SQL
 * function it ports, run in PostgreSQL (see load-db.ts) on many inputs.
 *
 *   fvinwmi, fvindescriptor, fvincheckdigit, fvincheckdigit2, fvinmodelyear2
 *       on the parity corpus VINs plus edge-case variants (case, length, spaces)
 *   sqlwild_to_regex, fvalidcharsinkey    on distinct vpic.Pattern keys
 *   pattern key matching (LIKE / regex)   on corpus var_keys x keys of their WMI's schemas
 *   felementattributevalue                on every (element, attribute) pair shipped in build/assets
 *
 * Usage: bun scripts/vpic/sql-verify/functions.ts [--size=3000] [--seed=3] [--keys=40000]
 *        [--db=postgres://postgres@localhost:5433/postgres] [--assets=build/assets] [--data=data/vpic]
 * Exits non-zero on any difference.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SQL } from "bun";
import { buildVarKeys, patternKeysMatch, sqlwildToRegex, validCharsInKey } from "../../../src/vpic/keys";
import type { SchemaBucket, SpecBucket } from "../../../src/vpic/types";
import {
  vinCheckDigit,
  vinCheckDigit2,
  vinDescriptor,
  vinModelYear2,
  vinWmi,
} from "../../../src/vpic/vin-functions";
import { buildCorpus, rng } from "../lib/corpus";

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}

const root = resolve(import.meta.dirname ?? ".", "../../..");
const size = Number(arg("size", "3000"));
const seed = Number(arg("seed", "3"));
const keyLimit = Number(arg("keys", "40000"));
const dbUrl = arg("db", process.env["DATABASE_URL"] ?? "postgres://postgres@localhost:5433/postgres");
const assetsDir = resolve(root, arg("assets", "build/assets"));
const dataDir = resolve(root, arg("data", "data/vpic"));

const sql = new SQL(dbUrl, { max: 8 });
const failures: string[] = [];
const counts: Record<string, number> = {};

function check(name: string, input: unknown, expected: unknown, actual: unknown): void {
  counts[name] = (counts[name] ?? 0) + 1;
  const e = JSON.stringify(expected);
  const a = JSON.stringify(actual);
  if (e !== a) failures.push(`${name}(${JSON.stringify(input)}): sql=${e} port=${a}`);
}

/** Runs `fn` over `items` with a few concurrent connections. */
async function forEach<T>(items: readonly T[], fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < items.length) await fn(items[next++] as T);
    })
  );
}

function vinInputs(): string[] {
  const rand = rng(seed);
  const vins = buildCorpus(assetsDir, dataDir, size, seed, new Date()).map((e) => e.vin);
  const out = new Set<string>(vins);
  for (const v of vins.slice(0, 500)) {
    out.add(v.toLowerCase());
    out.add(v.substring(0, 1 + Math.floor(rand() * 16)));
    out.add(` ${v} `);
    out.add(`${v.substring(0, 2)}9${v.substring(3)}`);
  }
  for (const v of ["", "1", "1HG", "1HGC", "1HGCM826", "1HGCM82633", "1HGCM82633A0043521234"]) out.add(v);
  return [...out];
}

async function scalarFunctions(now: Date): Promise<void> {
  await forEach(vinInputs(), async (vin) => {
    const [row] = (await sql`
      SELECT vpic.fvinwmi(${vin}) AS wmi, vpic.fvindescriptor(${vin}) AS descriptor,
             vpic.fvincheckdigit(${vin}) AS cd, vpic.fvincheckdigit2(${vin}, true) AS cd2t,
             vpic.fvincheckdigit2(${vin}, false) AS cd2f, vpic.fvinmodelyear2(${vin}) AS my,
             (SELECT vehicletypeid FROM vpic.wmi WHERE wmi = vpic.fvinwmi(upper(${vin}))) AS vt,
             (SELECT trucktypeid FROM vpic.wmi WHERE wmi = vpic.fvinwmi(upper(${vin}))) AS tt`) as Array<
      Record<string, string | number | null>
    >;
    if (!row) throw new Error("no row");
    check("fvinwmi", vin, row["wmi"], vinWmi(vin));
    check("fvindescriptor", vin, row["descriptor"], vinDescriptor(vin));
    check("fvincheckdigit", vin, row["cd"], vinCheckDigit(vin));
    check("fvincheckdigit2(true)", vin, row["cd2t"], vinCheckDigit2(vin, true));
    check("fvincheckdigit2(false)", vin, row["cd2f"], vinCheckDigit2(vin, false));
    const info = row["vt"] === null && row["tt"] === null ? null : { vehicleTypeId: row["vt"] as number | null, truckTypeId: row["tt"] as number | null };
    check("fvinmodelyear2", vin, row["my"], vinModelYear2(vin, info, now));
  });
}

async function keyFunctions(): Promise<void> {
  const rows = (await sql`
    (SELECT DISTINCT keys FROM vpic.pattern WHERE keys LIKE '%[%')
    UNION
    (SELECT keys FROM (SELECT DISTINCT keys FROM vpic.pattern) k ORDER BY md5(keys) LIMIT ${keyLimit})`) as Array<{
    keys: string;
  }>;
  await forEach(rows, async ({ keys }) => {
    const [r] = (await sql`SELECT vpic.sqlwild_to_regex(${keys}) AS re`) as Array<{ re: string }>;
    check("sqlwild_to_regex", keys, r?.re, sqlwildToRegex(keys));
    const chars = (await sql`SELECT pos, return_chr FROM vpic.fvalidcharsinkey(${keys})`) as Array<{
      pos: number;
      return_chr: string;
    }>;
    const norm = (list: ReadonlyArray<readonly [number, string]>) =>
      [...new Set(list.map(([p, c]) => `${p}:${c}`))].sort();
    check("fvalidcharsinkey", keys, norm(chars.map((c) => [c.pos, c.return_chr])), norm(validCharsInKey(keys)));
  });
}

/** The WHERE clause of spvindecode_core's Pattern select, for one VIN against its WMI's patterns. */
async function keyMatching(): Promise<void> {
  const vins = buildCorpus(assetsDir, dataDir, Math.min(size, 600), seed + 1, new Date())
    .map((e) => e.vin)
    .filter((v) => v.length >= 10);
  await forEach(vins, async (vin) => {
    const varKeys = buildVarKeys(vin);
    const rows = (await sql`
      SELECT p.id, p.keys,
        ((p.keys NOT LIKE '%[%' AND ${varKeys} LIKE replace(p.keys, '*', '_') || '%')
          OR (p.keys LIKE '%[%' AND ${varKeys} ~ p.keys_regex)) AS m
      FROM vpic.pattern p
      JOIN vpic.wmi_vinschema wvs ON wvs.vinschemaid = p.vinschemaid
      JOIN vpic.wmi w ON w.id = wvs.wmiid AND w.wmi = vpic.fvinwmi(${vin})`) as Array<{
      id: number;
      keys: string;
      m: boolean | null;
    }>;
    for (const r of rows) {
      check("pattern match", `${varKeys} ~ ${r.keys}`, r.m === true, patternKeysMatch(varKeys, r.keys));
      if (r.m === true) counts["pattern match (matching)"] = (counts["pattern match (matching)"] ?? 0) + 1;
    }
  });
}

async function lookups(): Promise<void> {
  const pairs = new Map<string, readonly [number, string, string | null]>();
  const add = (elementId: number, attributeId: string, resolved: string | null) =>
    pairs.set(`${elementId}|${attributeId}`, [elementId, attributeId, resolved]);
  for (const f of readdirSync(join(assetsDir, "vpic/schema"))) {
    const bucket = JSON.parse(readFileSync(join(assetsDir, "vpic/schema", f), "utf-8")) as SchemaBucket;
    for (const s of Object.values(bucket.schemas)) for (const p of s.patterns) add(p[2], p[3], p[4]);
  }
  for (const f of readdirSync(join(assetsDir, "vpic/spec"))) {
    const bucket = JSON.parse(readFileSync(join(assetsDir, "vpic/spec", f), "utf-8")) as SpecBucket;
    for (const list of Object.values(bucket.byMake))
      for (const s of list) for (const g of s.groups) for (const v of g.values) add(v[0], v[1], v[2]);
  }
  const all = [...pairs.values()];
  const ids = all.map(([e]) => e);
  const attrs = all.map(([, a]) => a);
  const rows = (await sql`
    SELECT e, a, vpic.felementattributevalue(e, a) AS v
    FROM unnest(${sql.array(ids, "int4")}::int[], ${sql.array(attrs, "varchar")}::varchar[]) AS t(e, a)`) as Array<{
    e: number;
    a: string;
    v: string | null;
  }>;
  for (const r of rows) check("felementattributevalue", `${r.e}:${r.a}`, r.v, pairs.get(`${r.e}|${r.a}`)?.[2] ?? null);
}

const now = new Date();
for (const [name, step] of [
  ["scalar VIN functions", () => scalarFunctions(now)],
  ["key functions", keyFunctions],
  ["pattern key matching", keyMatching],
  ["lookups", lookups],
] as const) {
  const t0 = Date.now();
  await step();
  console.log(`${name.padEnd(24)} done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await sql.close();

console.log("\nChecks per function:");
for (const [name, n] of Object.entries(counts)) console.log(`  ${name.padEnd(26)} ${n}`);
if (failures.length > 0) {
  console.error(`\n${failures.length} differences:`);
  for (const f of failures.slice(0, 40)) console.error(`  ${f}`);
  process.exit(1);
}
console.log("\nNo differences.");
