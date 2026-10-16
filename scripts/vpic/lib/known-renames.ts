/**
 * Allowlist of values the live vPIC API renamed after the bundled dump was published
 * (data/vpic-known-renames.json). The parity gate counts a VIN whose only differences
 * are allowlisted renames as an allowlisted match, and flags entries that a newer dump
 * already resolves (local value equals the live value) as stale.
 */

import { readFileSync } from "node:fs";

export type RenameScope = { readonly vin: string } | { readonly wmi: string };

export interface KnownRename {
  readonly scope: RenameScope;
  readonly field: string;
  readonly local: string;
  readonly live: string;
  readonly added: string;
  readonly source: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseKnownRenames(json: unknown): KnownRename[] {
  const entries = (json as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) throw new Error("known renames: missing entries array");
  return entries.map((raw, i) => {
    const e = raw as Record<string, unknown>;
    const scope = e["scope"] as Record<string, unknown> | undefined;
    const where = `known renames entry ${i}`;
    const vin = scope?.["vin"];
    const wmi = scope?.["wmi"];
    if ((vin === undefined) === (wmi === undefined)) throw new Error(`${where}: scope needs exactly one of vin or wmi`);
    if (vin !== undefined && (typeof vin !== "string" || !/^[A-HJ-NPR-Z0-9]{11,17}$/.test(vin))) throw new Error(`${where}: bad vin`);
    if (wmi !== undefined && (typeof wmi !== "string" || !/^[A-HJ-NPR-Z0-9]{3}$/.test(wmi))) throw new Error(`${where}: bad wmi`);
    for (const key of ["field", "local", "live", "source"] as const) {
      if (typeof e[key] !== "string" || (e[key] as string).trim() === "") throw new Error(`${where}: ${key} must be a non-empty string`);
    }
    if (typeof e["added"] !== "string" || !DATE.test(e["added"])) throw new Error(`${where}: added must be YYYY-MM-DD`);
    if (e["local"] === e["live"]) throw new Error(`${where}: local and live are identical`);
    return {
      scope: vin !== undefined ? { vin: vin as string } : { wmi: wmi as string },
      field: e["field"] as string,
      local: e["local"] as string,
      live: e["live"] as string,
      added: e["added"] as string,
      source: e["source"] as string,
    };
  });
}

export function loadKnownRenames(path: string): KnownRename[] {
  return parseKnownRenames(JSON.parse(readFileSync(path, "utf8")));
}

export function inScope(entry: KnownRename, vin: string): boolean {
  const v = vin.trim().toUpperCase();
  return "vin" in entry.scope ? v === entry.scope.vin : v.startsWith(entry.scope.wmi);
}

export function describeRename(entry: KnownRename): string {
  const scope = "vin" in entry.scope ? `VIN ${entry.scope.vin}` : `WMI ${entry.scope.wmi}`;
  return `${scope} ${entry.field}: ${JSON.stringify(entry.local)} -> ${JSON.stringify(entry.live)}`;
}

/** Tracks allowlist use across a parity run. */
export class RenameMatcher {
  private readonly used = new Set<KnownRename>();
  private readonly stale = new Set<KnownRename>();

  constructor(readonly entries: readonly KnownRename[]) {}

  /** The entry that explains a local/live difference for this VIN and field, if any. */
  explains(vin: string, field: string, local: string, live: string): KnownRename | undefined {
    const hit = this.entries.find(
      (e) => e.field === field && e.local === local.trim() && e.live === live.trim() && inScope(e, vin)
    );
    if (hit) this.used.add(hit);
    return hit;
  }

  /** Call for every compared field: flags entries the dump already resolves. */
  observe(vin: string, field: string, local: string, live: string): void {
    if (local.trim() !== live.trim()) return;
    for (const e of this.entries) {
      if (e.field === field && e.live === local.trim() && inScope(e, vin)) this.stale.add(e);
    }
  }

  usedEntries(): KnownRename[] {
    return this.entries.filter((e) => this.used.has(e));
  }

  staleEntries(): KnownRename[] {
    return this.entries.filter((e) => this.stale.has(e));
  }
}
