#!/usr/bin/env bun
/**
 * Differential test: the TypeScript port (src/vpic) vs the verbatim NHTSA functions
 * (vpic.spvindecode) running in PostgreSQL on the same data (see load-db.ts).
 * Unlike parity.ts (live API, newer data), any difference here comes from the code.
 *
 * Usage:
 *   bun scripts/vpic/sql-verify/compare.ts [--size=1000] [--seed=1] [--vins=A,B]
 *        [--db=postgres://postgres@localhost:5433/postgres] [--concurrency=4]
 *        [--assets=build/assets] [--data=data/vpic] [--out=build/sql-verify] [--max-unexpected=0]
 *
 * The port follows the live API (SQL Server) where it deliberately differs from the
 * PostgreSQL functions; those differences are classified as "expected" (see classify.ts).
 * Exits non-zero when the number of VINs with unexpected differences exceeds --max-unexpected.
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SQL } from "bun";
import { decodeVin, type DecodeResult } from "../../../src/vpic/decode";
import { VpicStore } from "../../../src/vpic/store";
import { buildCorpus, type CorpusEntry } from "../lib/corpus";
import { fsAssetReader } from "../lib/fs-reader";
import { classify, type Category, type Context } from "./classify";

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}

const root = resolve(import.meta.dirname ?? ".", "../../..");
const size = Number(arg("size", "1000"));
const seed = Number(arg("seed", "1"));
const vinList = arg("vins", "");
const dbUrl = arg("db", process.env["DATABASE_URL"] ?? "postgres://postgres@localhost:5433/postgres");
const concurrency = Number(arg("concurrency", "4"));
const assetsDir = resolve(root, arg("assets", "build/assets"));
const dataDir = resolve(root, arg("data", "data/vpic"));
const outDir = resolve(root, arg("out", "build/sql-verify"));
const maxUnexpected = Number(arg("max-unexpected", "0"));

interface SqlRow {
  itemelementid: number;
  code: string | null;
  value: string | null;
}

export interface FieldDiff {
  readonly elementId: number;
  readonly code: string;
  readonly sql: string;
  readonly port: string;
  readonly category: Category;
}

/** Element id -> values, sorted (the SQL output has no order within an element). */
function sqlValues(rows: readonly SqlRow[]): Map<number, { code: string; values: string[] }> {
  const out = new Map<number, { code: string; values: string[] }>();
  for (const r of rows) {
    const entry = out.get(r.itemelementid) ?? { code: r.code ?? String(r.itemelementid), values: [] };
    if (r.value !== null) entry.values.push(r.value);
    out.set(r.itemelementid, entry);
  }
  return out;
}

function portValues(result: DecodeResult): Map<number, { code: string; values: string[] }> {
  const out = new Map<number, { code: string; values: string[] }>();
  for (const e of result.elements) {
    const entry = out.get(e.elementId) ?? { code: e.code ?? String(e.elementId), values: [] };
    if (e.value !== null) entry.values.push(e.value);
    out.set(e.elementId, entry);
  }
  return out;
}

const joinSorted = (values: readonly string[]) => [...values].sort().join(" | ");

async function main(): Promise<void> {
  const now = new Date();
  const corpus: CorpusEntry[] = vinList
    ? vinList.split(",").map((v) => {
        const [vin = "", year] = v.split(":");
        return { vin, modelYear: year ? Number(year) : undefined, kind: "manual" };
      })
    : buildCorpus(assetsDir, dataDir, size, seed, now);

  const sql = new SQL(dbUrl, { max: concurrency });
  const store = new VpicStore(fsAssetReader(assetsDir));
  const ctx: Context = await loadContext(sql);

  const results: Array<{ entry: CorpusEntry; diffs: FieldDiff[]; sqlMs: number; error?: string }> = [];
  let next = 0;
  const worker = async () => {
    while (next < corpus.length) {
      const entry = corpus[next++] as CorpusEntry;
      try {
        const t0 = performance.now();
        const rows = (await sql`
          SELECT itemelementid, code, value
          FROM vpic.spvindecode(${entry.vin}, false, ${entry.modelYear ?? null}::integer)`) as SqlRow[];
        const sqlMs = performance.now() - t0;
        const port = await decodeVin(store, entry.vin, { modelYear: entry.modelYear ?? null, now });

        const s = sqlValues(rows);
        const p = portValues(port);
        const diffs: FieldDiff[] = [];
        for (const id of new Set([...s.keys(), ...p.keys()])) {
          const sv = joinSorted(s.get(id)?.values ?? []);
          const pv = joinSorted(p.get(id)?.values ?? []);
          if (sv === pv) continue;
          const code = s.get(id)?.code ?? p.get(id)?.code ?? String(id);
          diffs.push({ elementId: id, code, sql: sv, port: pv, category: "unexpected" });
        }
        const classified = classify(entry, diffs, ctx);
        results.push({ entry, diffs: classified, sqlMs });
      } catch (err) {
        results.push({ entry, diffs: [], sqlMs: 0, error: String(err) });
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  await sql.close();

  report(results);
}

async function loadContext(sql: SQL): Promise<Context> {
  const conv = (await sql`SELECT DISTINCT toelementid FROM vpic.conversion`) as Array<{ toelementid: number }>;
  const desc = (await sql`SELECT descriptor FROM vpic.vindescriptor`) as Array<{ descriptor: string }>;
  return {
    conversionTargets: new Set(conv.map((r) => r.toelementid)),
    vinDescriptors: new Set(desc.map((r) => r.descriptor)),
  };
}

function report(results: ReadonlyArray<{ entry: CorpusEntry; diffs: FieldDiff[]; sqlMs: number; error?: string }>): void {
  mkdirSync(outDir, { recursive: true });
  const errors = results.filter((r) => r.error);
  const unexpected = results.filter((r) => r.diffs.some((d) => d.category === "unexpected"));
  const expectedOnly = results.filter((r) => r.diffs.length > 0 && r.diffs.every((d) => d.category !== "unexpected"));
  const identical = results.filter((r) => !r.error && r.diffs.length === 0);

  const byCategory: Record<string, Record<string, number>> = {};
  for (const r of results) {
    for (const d of r.diffs) {
      byCategory[d.category] ??= {};
      const bucket = byCategory[d.category] as Record<string, number>;
      bucket[d.code] = (bucket[d.code] ?? 0) + 1;
    }
  }
  const sqlMs = results.map((r) => r.sqlMs).filter((m) => m > 0).sort((a, b) => a - b);

  const summary = {
    total: results.length,
    identical: identical.length,
    expectedOnly: expectedOnly.length,
    unexpected: unexpected.length,
    errors: errors.length,
    byCategory,
    sqlP50Ms: sqlMs[Math.floor(sqlMs.length / 2)] ?? null,
    unexpectedExamples: unexpected.slice(0, 40).map((r) => ({
      vin: r.entry.vin,
      modelYear: r.entry.modelYear ?? null,
      kind: r.entry.kind,
      diffs: r.diffs.filter((d) => d.category === "unexpected"),
    })),
    errorExamples: errors.slice(0, 10).map((r) => ({ vin: r.entry.vin, error: r.error })),
  };
  writeFileSync(join(outDir, "report.json"), `${JSON.stringify({ summary, results }, null, 1)}\n`);

  const md = [
    `## Port vs vpic.spvindecode (PostgreSQL, same data)`,
    ``,
    `| VINs | identical | expected differences only | unexpected | errors |`,
    `|---|---|---|---|---|`,
    `| ${summary.total} | ${summary.identical} | ${summary.expectedOnly} | ${summary.unexpected} | ${summary.errors} |`,
    ``,
    ...Object.entries(byCategory).map(
      ([cat, codes]) =>
        `- **${cat}**: ${Object.entries(codes).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ×${n}`).join(", ")}`
    ),
  ].join("\n");
  writeFileSync(join(outDir, "summary.md"), `${md}\n`);
  if (process.env["GITHUB_STEP_SUMMARY"]) appendFileSync(process.env["GITHUB_STEP_SUMMARY"], `${md}\n`);

  console.log(md);
  for (const ex of summary.unexpectedExamples.slice(0, 15)) {
    console.log(`\n${ex.vin}${ex.modelYear ? `:${ex.modelYear}` : ""} (${ex.kind})`);
    for (const d of ex.diffs) console.log(`  ${d.code}: sql=${JSON.stringify(d.sql)} port=${JSON.stringify(d.port)}`);
  }
  for (const ex of summary.errorExamples) console.log(`ERROR ${ex.vin}: ${ex.error}`);

  if (unexpected.length + errors.length > maxUnexpected) {
    console.error(`\n${unexpected.length} VINs with unexpected differences, ${errors.length} errors (max ${maxUnexpected}).`);
    process.exit(1);
  }
}

await main();
