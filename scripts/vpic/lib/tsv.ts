/**
 * Reader for the data/vpic TSV files written by ingest-dump.ts
 * (first line "#col1\tcol2...", fields in COPY text encoding).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { decodeCopyField } from "./pg-copy";

export type Row = Readonly<Record<string, string | null>>;

function parseFile(path: string): Row[] {
  const lines = readFileSync(path, "utf-8").split("\n");
  const header = lines[0];
  if (!header?.startsWith("#")) throw new Error(`${path}: missing '#' header line`);
  const columns = header.slice(1).split("\t");

  const rows: Row[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const fields = line.split("\t");
    if (fields.length !== columns.length) {
      throw new Error(`${path}:${i + 1}: expected ${columns.length} fields, got ${fields.length}`);
    }
    const row: Record<string, string | null> = {};
    columns.forEach((c, idx) => (row[c] = decodeCopyField(fields[idx] ?? "\\N")));
    rows.push(row);
  }
  return rows;
}

/** Reads `<dir>/<table>.tsv`, or every shard in `<dir>/<table>/` concatenated. */
export function readTable(dir: string, table: string): Row[] {
  const file = join(dir, `${table}.tsv`);
  if (existsSync(file)) return parseFile(file);

  const shardDir = join(dir, table);
  if (existsSync(shardDir) && statSync(shardDir).isDirectory()) {
    return readdirSync(shardDir)
      .filter((f) => f.endsWith(".tsv"))
      .sort()
      .flatMap((f) => parseFile(join(shardDir, f)));
  }
  throw new Error(`Table '${table}' not found in ${dir}`);
}

export function int(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n)) throw new Error(`Expected integer, got '${value}'`);
  return n;
}

export function requireInt(value: string | null | undefined, what: string): number {
  const n = int(value);
  if (n === null) throw new Error(`Missing integer for ${what}`);
  return n;
}

export function bool(value: string | null | undefined): boolean | null {
  if (value === null || value === undefined) return null;
  if (value === "t") return true;
  if (value === "f") return false;
  throw new Error(`Expected t/f, got '${value}'`);
}
