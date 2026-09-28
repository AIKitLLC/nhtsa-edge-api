#!/usr/bin/env bun
/**
 * Checks data/vpic against the original NHTSA dump restored in PostgreSQL: every
 * table the decoder uses must hold exactly the dump's rows (same projection as
 * ingest-dump.ts), and WMIYearValidChars must equal its aggregate. Also reports the
 * dump objects the decode functions read that data/vpic does not carry.
 *
 * Usage: bun scripts/vpic/sql-verify/projection.ts [--data=data/vpic]
 * Connection: libpq variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE); needs psql.
 * Exits non-zero on any difference.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { decodeCopyField, encodeCopyField, normalizeTimestamp } from "../lib/pg-copy";
import { TABLE_SPECS } from "../lib/tables";
import { ValidCharsAccumulator } from "../lib/valid-chars";

const root = resolve(import.meta.dirname ?? ".", "../../..");
const dataDir = resolve(root, process.argv.find((a) => a.startsWith("--data="))?.slice(7) ?? "data/vpic");

async function psqlOut(sql: string): Promise<string> {
  const proc = Bun.spawn(["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdout: "pipe", stderr: "pipe" });
  const [code, out, err] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`psql failed: ${err.trim()}`);
  return out;
}

/** Body lines of `<table>.tsv` or of every shard in `<table>/` (header line dropped). */
function dataLines(table: string): string[] {
  const file = join(dataDir, `${table}.tsv`);
  const dir = join(dataDir, table);
  const files = existsSync(file)
    ? [file]
    : existsSync(dir) && statSync(dir).isDirectory()
      ? readdirSync(dir).filter((f) => f.endsWith(".tsv")).map((f) => join(dir, f))
      : [];
  if (files.length === 0) throw new Error(`No data for ${table}`);
  return files.flatMap((f) => readFileSync(f, "utf-8").split("\n").slice(1).filter((l) => l !== ""));
}

/** Multiset difference of two line lists (a - b), capped for reporting. */
function difference(a: readonly string[], b: readonly string[]): { count: number; samples: string[] } {
  const counts = new Map<string, number>();
  for (const l of b) counts.set(l, (counts.get(l) ?? 0) + 1);
  const out: string[] = [];
  for (const l of a) {
    const n = counts.get(l) ?? 0;
    if (n > 0) counts.set(l, n - 1);
    else out.push(l);
  }
  return { count: out.length, samples: out.slice(0, 3) };
}

const failures: string[] = [];

function compare(name: string, dump: readonly string[], data: readonly string[]): void {
  const missing = difference(dump, data);
  const extra = difference(data, dump);
  const ok = missing.count === 0 && extra.count === 0;
  console.log(`${ok ? "ok  " : "DIFF"} ${name.padEnd(34)} dump ${String(dump.length).padStart(8)}  data ${String(data.length).padStart(8)}`);
  if (!ok) {
    failures.push(name);
    for (const s of missing.samples) console.log(`       only in dump: ${s}`);
    for (const s of extra.samples) console.log(`       only in data: ${s}`);
  }
}

for (const spec of TABLE_SPECS) {
  const select = spec.columns
    .map((c) => (c === "changedon" ? `coalesce(updatedon, createdon)` : `"${c}"`))
    .join(", ");
  const out = await psqlOut(`COPY (SELECT ${select} FROM vpic."${spec.table}") TO STDOUT`);
  const tsIdx = spec.columns.map((c, i) => (spec.timestamps?.includes(c) ? i : -1)).filter((i) => i >= 0);
  const dump = out
    .split("\n")
    .filter((l) => l !== "")
    .map((line) => {
      if (tsIdx.length === 0) return line;
      const f = line.split("\t");
      for (const i of tsIdx) f[i] = encodeCopyField(normalizeTimestamp(decodeCopyField(f[i] ?? "\\N")));
      return f.join("\t");
    });
  compare(spec.table, dump, dataLines(spec.table));
}

// WMIYearValidChars: re-aggregate the dump's rows exactly like ingest-dump.ts
{
  const acc = new ValidCharsAccumulator();
  const columns = ["wmi", "year", "position", "char"];
  // Position 0 rows are the cache-only sentinels of load-db.ts, not dump data
  const out = await psqlOut(`COPY (SELECT wmi, year, position, "char" FROM vpic.wmiyearvalidchars WHERE position <> 0) TO STDOUT`);
  let rows = 0;
  for (const line of out.split("\n")) {
    if (line === "") continue;
    acc.add(columns, line.split("\t"));
    rows++;
  }
  const dump = acc.rows().map((r) => r.join("\t"));
  console.log(`     (wmiyearvalidchars: ${rows} dump rows -> ${dump.length} (wmi, year) pairs)`);
  compare("wmiyearvalidchars (aggregated)", dump, dataLines("wmiyearvalidchars"));
}

// Objects read by the decode functions that data/vpic does not carry
console.log("\nNot in data/vpic (read by the decode functions):");
const exceptions = (await psqlOut(`COPY (SELECT DISTINCT wmi FROM vpic.wmiyearvalidchars_cacheexceptions ORDER BY 1) TO STDOUT`))
  .split("\n")
  .filter(Boolean);
console.log(`  WMIYearValidChars_CacheExceptions: ${exceptions.length} WMIs${exceptions.length ? ` (${exceptions.slice(0, 20).join(", ")}${exceptions.length > 20 ? ", ..." : ""})` : ""}`);
for (const view of ["vncsabodytype", "vncsamake", "vncsamodel"]) {
  const n = (await psqlOut(`COPY (SELECT count(*) FROM vpic.${view}) TO STDOUT`)).trim();
  console.log(`  ${view}: ${n} rows (elements 96-98 are private; not part of public output)`);
}
if (exceptions.length > 0) {
  failures.push("wmiyearvalidchars_cacheexceptions");
  console.log("  -> the port does not read CacheExceptions yet: these WMIs need handling.");
}

if (failures.length > 0) {
  console.error(`\n${failures.length} difference(s): ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\ndata/vpic is an exact projection of the dump.");
