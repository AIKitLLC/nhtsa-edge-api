#!/usr/bin/env bun
/**
 * Builds the Worker's static EPA assets (build/assets/epa/<year>/<make>.json) from data/epa.
 * Independent of scripts/vpic/build-assets.ts, which only clears its own build/assets/vpic.
 * A missing data/epa is not an error: the endpoint then answers 404 for everything.
 *
 * Usage: bun scripts/epa/build-assets.ts [--data=data/epa] [--out=build/assets]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { epaShardPath, type EpaShard, type EpaVehicle } from "../../src/epa/store";

const arg = (name: string, fallback: string): string =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const root = resolve(import.meta.dirname ?? ".", "../..");
const dataDir = resolve(root, arg("data", "data/epa"));
const outDir = resolve(root, arg("out", "build/assets"));

const NUMBER = /^-?\d+(\.\d+)?$/;

/** Builds the shards of a table (header first). Blank values are omitted, numbers become numbers. */
export function buildShards(table: readonly (readonly string[])[], sourceDate: string): Map<string, EpaShard> {
  const [header = [], ...rows] = table;
  const year = header.indexOf("year");
  const make = header.indexOf("make");
  const grouped = new Map<string, EpaVehicle[]>();
  for (const row of rows) {
    const vehicle: Record<string, string | number> = {};
    header.forEach((name, i) => {
      const v = row[i] ?? "";
      if (v !== "") vehicle[name] = NUMBER.test(v) ? Number(v) : v;
    });
    const path = epaShardPath(row[year] ?? "", row[make] ?? "");
    const shard = grouped.get(path);
    if (shard) shard.push(vehicle);
    else grouped.set(path, [vehicle]);
  }
  return new Map([...grouped].map(([path, vehicles]) => [path, { sourceDate, vehicles }]));
}

if (import.meta.main) {
  const tsv = join(dataDir, "vehicles.tsv");
  if (!existsSync(tsv)) {
    console.log("epa: no data/epa, nothing to build");
  } else {
    const { sourceDate } = JSON.parse(readFileSync(join(dataDir, "manifest.json"), "utf-8")) as { sourceDate: string };
    const table = readFileSync(tsv, "utf-8").trimEnd().split("\n").map((line) => line.split("\t"));
    const shards = buildShards(table, sourceDate);
    for (const [path, shard] of shards) {
      mkdirSync(dirname(join(outDir, path)), { recursive: true });
      writeFileSync(join(outDir, path), JSON.stringify(shard));
    }
    console.log(`epa: ${table.length - 1} vehicles in ${shards.size} files`);
  }
}
