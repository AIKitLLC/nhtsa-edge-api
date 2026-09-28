#!/usr/bin/env bun
/**
 * Ingests an official NHTSA vPICList_lite PostgreSQL dump into data/vpic (git-tracked TSV).
 *
 * Usage:
 *   bun scripts/vpic/ingest-dump.ts                         # newest dump on the NHTSA downloads page
 *   bun scripts/vpic/ingest-dump.ts --dump=vPICList_lite_2026_09
 *   bun scripts/vpic/ingest-dump.ts --file=./vPICList_lite_2026_09.plain.zip
 *
 * Output is deterministic: re-ingesting the same dump produces byte-identical files,
 * so a new dump shows up in git as a reviewable (and revertable) diff.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { normalizeTimestamp, readCopyBlocks } from "./lib/pg-copy";
import { TABLE_SPECS, deriveColumn, type TableSpec } from "./lib/tables";
import { DOWNLOADS_URL, findLatestDumpName } from "./lib/downloads";
import { ValidCharsAccumulator } from "./lib/valid-chars";
import { fnv1a } from "../../src/vpic/store";

const VALID_CHARS_TABLE = "wmiyearvalidchars";
const VALID_CHARS_SHARDS = 8;

const DATA_DIR = resolve(import.meta.dirname ?? ".", "../../data/vpic");

interface Args {
  readonly dump?: string;
  readonly file?: string;
}

function parseArgs(argv: readonly string[]): Args {
  const get = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  return { dump: get("dump"), file: get("file") };
}

async function downloadDump(dumpName: string, target: string): Promise<void> {
  const url = `${DOWNLOADS_URL}/${dumpName}.plain.zip`;
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": "nhtsa-edge-api-ingest/1.0" } });
  if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  const expected = Number(res.headers.get("content-length") ?? "0");
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(target));
  const actual = statSync(target).size;
  if (expected > 0 && actual !== expected) {
    rmSync(target, { force: true });
    throw new Error(`Incomplete download: ${actual} of ${expected} bytes`);
  }
  console.log(`Downloaded ${(actual / 1e6).toFixed(1)} MB`);
}

/** Streams the .sql member of the zip without extracting it to disk. */
function openSqlStream(zipPath: string): { stream: Readable; done: Promise<void> } {
  const child = spawn("unzip", ["-p", zipPath, "*.sql"], { stdio: ["ignore", "pipe", "inherit"] });
  const done = new Promise<void>((resolveDone, reject) => {
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolveDone() : reject(new Error(`unzip exited with ${code}`))));
  });
  return { stream: child.stdout, done };
}

function compareRows(sortIdx: readonly number[]) {
  return (a: readonly (string | null)[], b: readonly (string | null)[]): number => {
    for (const i of sortIdx) {
      const diff = Number(a[i]) - Number(b[i]);
      if (diff !== 0) return diff;
    }
    return 0;
  };
}

function encodeRow(row: readonly (string | null)[]): string {
  // Fields are still COPY-encoded (escapes preserved), only NULL needs mapping.
  return row.map((v) => (v === null ? "\\N" : v)).join("\t");
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  let zipPath = args.file;
  let dumpName = args.dump ?? (zipPath ? basename(zipPath).replace(/\.plain\.zip$/, "") : undefined);
  if (!zipPath) {
    dumpName ??= await findLatestDumpName();
    zipPath = resolve(`./${dumpName}.plain.zip`);
    if (!existsSync(zipPath)) await downloadDump(dumpName, zipPath);
  }
  if (!dumpName) throw new Error("Could not determine the dump name");
  console.log(`Ingesting ${dumpName} from ${zipPath}`);

  const specs = new Map<string, TableSpec>(TABLE_SPECS.map((s) => [s.table, s]));
  const rows = new Map<string, (string | null)[][]>();
  const columnIndex = new Map<string, readonly string[]>();

  const validChars = new ValidCharsAccumulator();
  const { stream, done } = openSqlStream(zipPath);
  const seen = await readCopyBlocks(
    stream,
    (table) => specs.has(table) || table === VALID_CHARS_TABLE,
    (header, fields) => {
      if (header.table === VALID_CHARS_TABLE) {
        validChars.add(header.columns, fields);
        return;
      }
      const spec = specs.get(header.table);
      if (!spec) return;
      if (!columnIndex.has(header.table)) columnIndex.set(header.table, header.columns);

      const record: Record<string, string | null> = {};
      header.columns.forEach((col, i) => {
        const raw = fields[i];
        record[col] = raw === undefined || raw === "\\N" ? null : raw;
      });

      const out = spec.columns.map((col) => {
        const value = deriveColumn(col, record);
        return spec.timestamps?.includes(col) ? normalizeTimestamp(value) : value;
      });

      let list = rows.get(header.table);
      if (!list) rows.set(header.table, (list = []));
      list.push(out);
    }
  );
  await done;

  const missing = [...TABLE_SPECS.map((s) => s.table), VALID_CHARS_TABLE].filter((t) => !seen.has(t));
  if (missing.length > 0) throw new Error(`Tables missing from dump: ${missing.join(", ")}`);

  // Rewrite data/vpic from scratch so tables dropped from the spec disappear too
  if (existsSync(DATA_DIR)) {
    for (const entry of readdirSync(DATA_DIR)) rmSync(join(DATA_DIR, entry), { recursive: true, force: true });
  }
  mkdirSync(DATA_DIR, { recursive: true });

  const manifestTables: Record<string, { rows: number; files: Record<string, string> }> = {};

  for (const spec of TABLE_SPECS) {
    const list = rows.get(spec.table) ?? [];
    const sortIdx = spec.sortBy.map((c) => spec.columns.indexOf(c));
    list.sort(compareRows(sortIdx));

    const header = `#${spec.columns.join("\t")}`;
    const shards = spec.shards ?? 1;
    const files: Record<string, string> = {};

    if (shards === 1) {
      const text = [header, ...list.map(encodeRow)].join("\n") + "\n";
      const rel = `${spec.table}.tsv`;
      writeFileSync(join(DATA_DIR, rel), text);
      files[rel] = sha256(text);
    } else {
      const shardIdx = spec.columns.indexOf(spec.shardBy ?? "id");
      const buckets: string[][] = Array.from({ length: shards }, () => [header]);
      for (const row of list) {
        const bucket = Number(row[shardIdx]) % shards;
        buckets[bucket]?.push(encodeRow(row));
      }
      mkdirSync(join(DATA_DIR, spec.table), { recursive: true });
      buckets.forEach((lines, i) => {
        const text = lines.join("\n") + "\n";
        const rel = `${spec.table}/${String(i).padStart(2, "0")}.tsv`;
        writeFileSync(join(DATA_DIR, rel), text);
        files[rel] = sha256(text);
      });
    }

    manifestTables[spec.table] = { rows: list.length, files };
    console.log(`  ${spec.table.padEnd(36)} ${String(list.length).padStart(9)} rows`);
  }

  // WMIYearValidChars, aggregated per (wmi, year), sharded by WMI hash
  {
    const header = "#wmi\tyear\tvalidchars";
    const buckets: string[][] = Array.from({ length: VALID_CHARS_SHARDS }, () => [header]);
    const rowsOut = validChars.rows();
    for (const row of rowsOut) buckets[fnv1a(row[0] ?? "") % VALID_CHARS_SHARDS]?.push(row.join("\t"));
    mkdirSync(join(DATA_DIR, VALID_CHARS_TABLE), { recursive: true });
    const files: Record<string, string> = {};
    buckets.forEach((lines, i) => {
      const text = lines.join("\n") + "\n";
      const rel = `${VALID_CHARS_TABLE}/${String(i).padStart(2, "0")}.tsv`;
      writeFileSync(join(DATA_DIR, rel), text);
      files[rel] = sha256(text);
    });
    manifestTables[VALID_CHARS_TABLE] = { rows: rowsOut.length, files };
    console.log(`  ${VALID_CHARS_TABLE.padEnd(36)} ${String(rowsOut.length).padStart(9)} (wmi, year) pairs`);
  }

  const manifest = {
    dumpVersion: dumpName,
    source: `${DOWNLOADS_URL}/${dumpName}.plain.zip`,
    tables: manifestTables,
  };
  writeFileSync(join(DATA_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Wrote ${DATA_DIR}/manifest.json (${dumpName})`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
