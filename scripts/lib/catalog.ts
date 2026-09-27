/**
 * Shared helpers for the data maintenance scripts (run with Bun or Node >= 18).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mergeModels } from "./merge";

export const VPIC_API_BASE = "https://vpic.nhtsa.dot.gov/api";

export const TOP_MAKES: readonly string[] = [
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

export type ModelCatalog = Record<string, string[]>;

export function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

/**
 * Writes JSON in the repository's format (2-space indent) only when the
 * content actually changed. Returns true when the file was written.
 */
export function writeJsonIfChanged(path: string, value: unknown, trailingNewline = false): boolean {
  const next = JSON.stringify(value, null, 2) + (trailingNewline ? "\n" : "");
  const current = existsSync(path) ? readFileSync(path, "utf-8") : null;
  if (current === next) return false;
  writeFileSync(path, next, "utf-8");
  return true;
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": "nhtsa-edge-api-data-sync/1.0", ...init.headers },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches the de-duplicated model names NHTSA currently lists for a make.
 */
export async function fetchModelsForMake(make: string): Promise<string[]> {
  const url = `${VPIC_API_BASE}/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = (await res.json()) as { Results?: Array<{ Model_Name?: unknown }> };
  const names = new Set<string>();
  for (const item of data.Results ?? []) {
    if (typeof item.Model_Name === "string" && item.Model_Name.trim() !== "") {
      names.add(item.Model_Name.trim());
    }
  }
  return [...names];
}

export async function refreshMakes(
  catalog: ModelCatalog,
  makes: readonly string[]
): Promise<{ added: number; failed: string[] }> {
  let added = 0;
  const failed: string[] = [];

  for (const make of makes) {
    process.stdout.write(`   ${make}... `);
    try {
      const fetched = await fetchModelsForMake(make);
      const existing = catalog[make] ?? [];
      const merged = mergeModels(existing, fetched);
      const newCount = merged.length - existing.length;
      if (newCount > 0) {
        catalog[make] = merged;
      }
      added += newCount;
      console.log(newCount > 0 ? `+${newCount} new (${merged.length} total)` : `up to date (${merged.length})`);
    } catch (err: unknown) {
      failed.push(make);
      console.log(`failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { added, failed };
}

export function countModels(catalog: ModelCatalog): number {
  return Object.values(catalog).reduce((sum, models) => sum + models.length, 0);
}
