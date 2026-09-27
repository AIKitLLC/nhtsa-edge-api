#!/usr/bin/env bun
/**
 * Scheduled dataset maintenance (run by .github/workflows/nhtsa-sql-sync.yml).
 *
 * 1. Detects whether NHTSA published a newer monthly vPICList dump than the
 *    one the bundled data was extracted from. Ingesting a dump is a manual,
 *    reviewed step (see docs/DATA.md); this script only reports it.
 * 2. Adds newly registered models for the top makes from the live API.
 * 3. Rewrites data/sync-metadata.json only when something actually changed,
 *    so scheduled runs do not produce empty commits.
 */

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  TOP_MAKES,
  countModels,
  fetchWithTimeout,
  readJson,
  refreshMakes,
  writeJsonIfChanged,
  type ModelCatalog,
} from "./lib/catalog";
import { dumpCandidates } from "./lib/dumps";

interface SyncMetadata {
  activeDumpVersion: string;
  latestAvailableDump?: string | null;
  lastSyncedAt: string;
  wmiCount: number;
  makesCount: number;
  modelsCount: number;
  source: string;
  lastCheckStatus?: string;
}

const DATA_DIR = resolve(import.meta.dirname ?? ".", "../data");
const METADATA_PATH = resolve(DATA_DIR, "sync-metadata.json");
const WMI_PATH = resolve(DATA_DIR, "wmi-master.json");
const MAKES_MODELS_PATH = resolve(DATA_DIR, "makes-models.json");
const NHTSA_DOWNLOADS_URL = "https://vpic.nhtsa.dot.gov/downloads";
const MONTHS_TO_PROBE = 6;

async function dumpExists(name: string): Promise<boolean> {
  for (const ext of [".plain.zip", ".bak.zip", ".bak"]) {
    try {
      const res = await fetchWithTimeout(`${NHTSA_DOWNLOADS_URL}/${name}${ext}`, { method: "HEAD" }, 10000);
      if (res.status === 200) return true;
    } catch {
      // Network error on one candidate: try the next extension
    }
  }
  return false;
}

async function findLatestDump(): Promise<string | null> {
  for (const name of dumpCandidates(new Date(), MONTHS_TO_PROBE)) {
    process.stdout.write(`   ${name}... `);
    if (await dumpExists(name)) {
      console.log("available");
      return name;
    }
    console.log("not found");
  }
  return null;
}

function writeStepSummary(lines: string[]): void {
  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath) appendFileSync(summaryPath, lines.join("\n") + "\n");
}

async function main(): Promise<void> {
  const metadata = readJson<SyncMetadata>(METADATA_PATH, {
    activeDumpVersion: "unknown",
    lastSyncedAt: new Date(0).toISOString(),
    wmiCount: 0,
    makesCount: 0,
    modelsCount: 0,
    source: `${NHTSA_DOWNLOADS_URL}/`,
  });
  const before = JSON.stringify(metadata);

  console.log(`Bundled data extracted from: ${metadata.activeDumpVersion}`);
  console.log("Probing NHTSA downloads for newer monthly dumps...");
  const latestDump = await findLatestDump();
  const newDumpAvailable = latestDump !== null && latestDump !== metadata.activeDumpVersion;
  if (latestDump !== null) {
    metadata.latestAvailableDump = latestDump;
  }

  console.log("Adding newly registered models from the live API...");
  const catalog = readJson<ModelCatalog>(MAKES_MODELS_PATH, {});
  const { added, failed } = await refreshMakes(catalog, TOP_MAKES);
  if (failed.length === TOP_MAKES.length) {
    throw new Error("NHTSA live API unreachable for every make - leaving data files untouched");
  }
  const catalogChanged = writeJsonIfChanged(MAKES_MODELS_PATH, catalog);

  const wmis = readJson<Record<string, unknown>>(WMI_PATH, {});
  metadata.wmiCount = Object.keys(wmis).length;
  metadata.makesCount = Object.keys(catalog).length;
  metadata.modelsCount = countModels(catalog);
  metadata.lastCheckStatus = newDumpAvailable
    ? `New dump ${latestDump} available - manual ingestion required (docs/DATA.md)`
    : "Bundled dump is the latest detected";

  if (JSON.stringify(metadata) !== before || catalogChanged) {
    metadata.lastSyncedAt = new Date().toISOString();
    writeJsonIfChanged(METADATA_PATH, metadata, true);
  }

  const summary = [
    "## NHTSA dataset sync",
    `- Bundled dump: \`${metadata.activeDumpVersion}\``,
    `- Latest detected dump: \`${latestDump ?? "none detected"}\``,
    `- New models added: **${added}** (catalog ${catalogChanged ? "updated" : "unchanged"})`,
    failed.length > 0 ? `- Failed makes: ${failed.join(", ")}` : "- All makes refreshed",
  ];
  if (newDumpAvailable) {
    summary.push("", `> **Action needed:** ingest \`${latestDump}\` manually, see docs/DATA.md.`);
  }
  writeStepSummary(summary);
  console.log(summary.join("\n"));
}

main().catch((err: unknown) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
