#!/usr/bin/env bun
/**
 * Loads data/vpic and the verbatim NHTSA decode functions into a PostgreSQL database,
 * so vpic.spvindecode can be run against the exact data the offline decoder uses.
 *
 * Usage: bun scripts/vpic/sql-verify/load-db.ts [--data=data/vpic] [--pg-fallback]
 *   --pg-fallback  keep the PostgreSQL valid-characters fallback (see schema.ts cacheOnlySql)
 * Connection: the usual libpq variables (PGHOST, PGPORT, PGUSER, PGDATABASE); needs psql.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { TABLE_SPECS } from "../lib/tables";
import { cacheOnlySql, postLoadSql, schemaDdl } from "./schema";

const root = resolve(import.meta.dirname ?? ".", "../../..");
const dataDir = resolve(root, process.argv.find((a) => a.startsWith("--data="))?.slice(7) ?? "data/vpic");
const pgFallback = process.argv.includes("--pg-fallback");
const functionsFile = join(root, "docs/vpic-reference/decode-functions.sql");

async function psql(input: string, label: string): Promise<void> {
  const proc = Bun.spawn(["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1"], {
    stdin: new TextEncoder().encode(input),
    stdout: "inherit",
    stderr: "pipe",
  });
  const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`psql failed (${label}): ${err.trim()}`);
}

/** The TSV files of a table: `<table>.tsv` or every shard in `<table>/`. */
function tableFiles(table: string): string[] {
  const file = join(dataDir, `${table}.tsv`);
  if (existsSync(file)) return [file];
  const dir = join(dataDir, table);
  if (existsSync(dir) && statSync(dir).isDirectory()) {
    return readdirSync(dir).filter((f) => f.endsWith(".tsv")).sort().map((f) => join(dir, f));
  }
  throw new Error(`No data for table '${table}' in ${dataDir}`);
}

/** COPY one TSV file (header line "#col\t...", body already in COPY text format). */
async function copyFile(table: string, file: string): Promise<number> {
  const text = readFileSync(file, "utf-8");
  const newline = text.indexOf("\n");
  const header = text.slice(0, newline);
  if (!header.startsWith("#")) throw new Error(`${file}: missing '#' header line`);
  const columns = header.slice(1).split("\t").map((c) => `"${c}"`).join(", ");
  const body = text.slice(newline + 1);
  await psql(`COPY vpic."${table}" (${columns}) FROM STDIN;\n${body}${body.endsWith("\n") || !body ? "" : "\n"}\\.\n`, file);
  return body.split("\n").filter(Boolean).length;
}

async function main(): Promise<void> {
  const started = Date.now();
  await psql(schemaDdl(), "schema");

  for (const spec of TABLE_SPECS) {
    let rows = 0;
    for (const file of tableFiles(spec.table)) rows += await copyFile(spec.table, file);
    console.log(`${spec.table.padEnd(36)} ${rows}`);
  }
  let aggRows = 0;
  for (const file of tableFiles("wmiyearvalidchars")) aggRows += await copyFile("wmiyearvalidchars_agg", file);
  console.log(`${"wmiyearvalidchars (aggregated)".padEnd(36)} ${aggRows}`);

  await psql(readFileSync(functionsFile, "utf-8"), "decode functions");
  await psql(postLoadSql(), "post-load");
  if (!pgFallback) await psql(cacheOnlySql(), "cache-only valid characters");
  console.log(`Loaded in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

await main();
