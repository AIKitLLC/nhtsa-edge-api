#!/usr/bin/env bun
/**
 * Ingests EPA/DOE FuelEconomy.gov's vehicles.csv into data/epa (git-tracked).
 *
 * Keeps the columns the API serves, one row per EPA vehicle record, sorted so a
 * refresh that changes nothing produces no diff. Fails if the source no longer has a
 * column we keep: a renamed column must be reviewed, not silently dropped.
 *
 * Usage: bun scripts/epa/ingest.ts --csv=vehicles.csv --source-date=2026-09-29 [--out=data/epa]
 * Source: https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip (public domain, U.S. Government work)
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseCsv } from "./csv";

export const SOURCE_URL = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip";

/** Columns served by the API, with EPA's own names (documented at fueleconomy.gov/feg/ws). */
export const COLUMNS = [
  "id", "year", "make", "model", "baseModel", "VClass", "drive", "trany", "cylinders", "displ", "eng_dscr",
  "fuelType", "fuelType1", "fuelType2", "atvType", "evMotor", "tCharger", "sCharger", "startStop",
  "city08", "highway08", "comb08", "cityE", "highwayE", "combE", "range", "rangeCity", "rangeHwy",
  "charge240", "phevComb", "co2TailpipeGpm", "fuelCost08", "youSaveSpend", "feScore", "ghgScore",
] as const;

const cell = (v: string | undefined): string => (v ?? "").replace(/[\t\r\n]+/g, " ").trim();

/** Selected rows (header first), ordered by year, make, model, id. */
export function selectColumns(csv: string): string[][] {
  const [header = [], ...records] = parseCsv(csv);
  const at = new Map(header.map((name, i) => [name, i]));
  const missing = COLUMNS.filter((c) => !at.has(c));
  if (missing.length > 0) throw new Error(`vehicles.csv lacks expected columns: ${missing.join(", ")}`);

  const idx = COLUMNS.map((c) => at.get(c) as number);
  const rows = records
    .filter((r) => r.length > 1)
    .map((r) => idx.map((i) => cell(r[i])));
  const [id, year, make, model] = [0, 1, 2, 3] as const;
  rows.sort(
    (a, b) =>
      Number(a[year]) - Number(b[year]) ||
      (a[make] ?? "").localeCompare(b[make] ?? "") ||
      (a[model] ?? "").localeCompare(b[model] ?? "") ||
      Number(a[id]) - Number(b[id])
  );
  return [[...COLUMNS], ...rows];
}

if (import.meta.main) {
  const arg = (name: string): string | undefined => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const csvPath = arg("csv");
  const sourceDate = arg("source-date");
  if (!csvPath || !sourceDate || !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate)) {
    console.error("Usage: bun scripts/epa/ingest.ts --csv=vehicles.csv --source-date=YYYY-MM-DD [--out=data/epa]");
    process.exit(1);
  }
  const out = resolve(arg("out") ?? join(import.meta.dirname ?? ".", "../../data/epa"));
  const text = readFileSync(resolve(csvPath), "utf-8");
  const table = selectColumns(text);

  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "vehicles.tsv"), table.map((r) => r.join("\t")).join("\n") + "\n");
  const manifest = {
    source: SOURCE_URL,
    sourceDate,
    sourceSha256: createHash("sha256").update(text).digest("hex"),
    rows: table.length - 1,
    columns: COLUMNS,
  };
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(`epa: ${manifest.rows} vehicles, ${COLUMNS.length} columns, source ${sourceDate}`);
}
