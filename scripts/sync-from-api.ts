#!/usr/bin/env bun
/**
 * CLI Script: Sync fresh vehicle makes & models from NHTSA live API directly into Git data files
 * Usage:
 *   bun scripts/sync-from-api.ts
 *   bun scripts/sync-from-api.ts --make=Tesla
 */

import fs from "node:fs";
import path from "node:path";

const BASE_URL = "https://vpic.nhtsa.dot.gov/api";
const catalogPath = path.resolve("./data/makes-models.json");

interface ModelResult {
  Model_ID: number;
  Model_Name: string;
}

async function fetchModelsForMake(make: string): Promise<string[]> {
  const url = `${BASE_URL}/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`;
  const res = await fetch(url, { headers: { "User-Agent": "NHTSA-Sync-Tool/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json() as { Results?: ModelResult[] };
  const models: string[] = [];
  for (const item of data.Results ?? []) {
    if (item.Model_Name && typeof item.Model_Name === "string") {
      const trimmed = item.Model_Name.trim();
      if (!models.includes(trimmed)) {
        models.push(trimmed);
      }
    }
  }
  return models;
}

async function main() {
  console.log("==========================================================");
  console.log("🔄 NHTSA Live API Synchronizer (Channel 2: Direct Sync)");
  console.log("==========================================================");

  let catalog: Record<string, string[]> = {};
  if (fs.existsSync(catalogPath)) {
    catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8")) as Record<string, string[]>;
  }

  const args = process.argv.slice(2);
  const makeArg = args.find((a) => a.startsWith("--make="))?.replace("--make=", "");

  const targetMakes = makeArg
    ? [makeArg.toUpperCase()]
    : [
        "TOYOTA",
        "HONDA",
        "FORD",
        "CHEVROLET",
        "TESLA",
        "BMW",
        "MERCEDES-BENZ",
        "HYUNDAI",
        "KIA",
        "NISSAN",
        "AUDI",
        "VOLKSWAGEN",
        "PORSCHE",
        "MAZDA",
        "SUBARU",
        "LEXUS",
        "JEEP",
        "RIVIAN",
        "LUCID",
        "VINFAST",
      ];

  console.log(`Syncing models for ${targetMakes.length} makes directly from NHTSA API...`);

  let newModelsTotal = 0;

  for (const make of targetMakes) {
    process.stdout.write(`   Fetching ${make}... `);
    try {
      const models = await fetchModelsForMake(make);
      const existing = catalog[make] ?? [];
      const newModels = models.filter((m) => !existing.includes(m));

      catalog[make] = models;
      newModelsTotal += newModels.length;

      if (newModels.length > 0) {
        console.log(`✅ ${models.length} models (${newModels.length} new: ${newModels.slice(0, 3).join(", ")}${newModels.length > 3 ? "..." : ""})`);
      } else {
        console.log(`✅ ${models.length} models (up to date)`);
      }
    } catch (err: unknown) {
      console.log(`❌ Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
  const stats = fs.statSync(catalogPath);

  console.log("----------------------------------------------------------");
  console.log(`✅ Sync Complete! ${newModelsTotal} new models discovered.`);
  console.log(`📁 Updated ${catalogPath} (${(stats.size / 1024).toFixed(1)} KB)`);
  console.log("==========================================================");
}

main().catch(console.error);
