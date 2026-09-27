#!/usr/bin/env bun
/**
 * Adds newly registered models from the NHTSA live API into data/makes-models.json.
 * Existing models are never removed.
 *
 * Usage:
 *   bun scripts/sync-from-api.ts              # top makes
 *   bun scripts/sync-from-api.ts --make=Tesla # a single make
 */

import { resolve } from "node:path";
import { TOP_MAKES, countModels, readJson, refreshMakes, writeJsonIfChanged, type ModelCatalog } from "./lib/catalog";

const CATALOG_PATH = resolve(import.meta.dirname ?? ".", "../data/makes-models.json");

async function main(): Promise<void> {
  const makeArg = process.argv.slice(2).find((a) => a.startsWith("--make="))?.slice("--make=".length);
  const targetMakes = makeArg ? [makeArg.trim().toUpperCase()] : TOP_MAKES;

  const catalog = readJson<ModelCatalog>(CATALOG_PATH, {});
  console.log(`Refreshing ${targetMakes.length} make(s) from the NHTSA live API...`);

  const { added, failed } = await refreshMakes(catalog, targetMakes);
  const written = writeJsonIfChanged(CATALOG_PATH, catalog);

  console.log(`Done: ${added} new models, ${countModels(catalog)} total, file ${written ? "updated" : "unchanged"}.`);
  if (failed.length > 0) {
    console.warn(`Failed makes: ${failed.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
