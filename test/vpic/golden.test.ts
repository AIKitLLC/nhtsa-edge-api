import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeVin } from "../../src/vpic/decode";
import { toDecodeVinValues } from "../../src/vpic/format";
import { VpicStore } from "../../src/vpic/store";
import { fsAssetReader } from "../../scripts/vpic/lib/fs-reader";
import { ASSETS_DIR } from "../helpers/assets";

/**
 * Regression lock against real NHTSA output: every VIN in the fixture was decoded by
 * the live vPIC API (recorded by scripts/vpic/parity.ts --golden) and matched the
 * offline decoder on every field. The fixture is regenerated in the same commit as
 * each data/vpic update, so data and expectations always move together.
 */

interface GoldenFile {
  readonly dumpVersion: string;
  readonly vins: readonly { vin: string; modelYear?: number; kind: string; live: Record<string, string> }[];
}

const FIXTURE = resolve(__dirname, "../fixtures/vpic-golden.json");
const golden: GoldenFile | null = existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, "utf-8")) as GoldenFile) : null;

describe.runIf(golden !== null)("Offline decoder vs recorded live vPIC results", () => {
  const store = new VpicStore(fsAssetReader(ASSETS_DIR));

  it("fixture belongs to the bundled data version", async () => {
    const core = await store.getCore();
    expect(golden?.dumpVersion).toBe(core.dumpVersion);
  });

  it("reproduces every recorded live field", async () => {
    const failures: string[] = [];
    for (const entry of golden?.vins ?? []) {
      const result = await decodeVin(store, entry.vin, { modelYear: entry.modelYear ?? null });
      const local = toDecodeVinValues(result, entry.live["VIN"] ?? entry.vin);
      for (const [key, value] of Object.entries(local)) {
        const expected = entry.live[key] ?? "";
        if (value.trim() !== expected.trim()) {
          failures.push(`${entry.vin} ${key}: local=${JSON.stringify(value)} live=${JSON.stringify(expected)}`);
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
  });
});
