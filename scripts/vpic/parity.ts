#!/usr/bin/env bun
/**
 * Parity check: offline decoder vs the live vPIC API (DecodeVINValuesBatch).
 *
 * Usage:
 *   bun scripts/vpic/parity.ts [--size=500] [--seed=1] [--min-exact=0.97]
 *                              [--assets=build/assets] [--data=data/vpic] [--out=build/parity]
 *                              [--golden=test/fixtures/vpic-golden.json --golden-size=300]
 *
 * Writes <out>/report.json and <out>/summary.md (also appended to GITHUB_STEP_SUMMARY),
 * and <out>/live-sample.json (raw live results, reused as regression fixtures).
 * With --golden, the VINs that matched on every field are saved with their live
 * results (non-empty values only) as the regression fixture of test/vpic/golden.test.ts.
 * Differences listed in --renames (data/vpic-known-renames.json) do not fail a VIN; such VINs are
 * reported separately as allowlisted matches, and allowlist entries that the dump already
 * resolves are reported as stale (with a GitHub ::warning).
 * Exits non-zero when strict plus allowlisted matches are below --min-exact.
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { decodeVin } from "../../src/vpic/decode";
import { toDecodeVinValues } from "../../src/vpic/format";
import { VpicStore } from "../../src/vpic/store";
import { buildCorpus, type CorpusEntry } from "./lib/corpus";
import { fsAssetReader } from "./lib/fs-reader";
import { describeRename, loadKnownRenames, RenameMatcher } from "./lib/known-renames";

const BATCH_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/";
const BATCH_SIZE = 50;
const PAUSE_MS = 1500;

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}

const root = resolve(import.meta.dirname ?? ".", "../..");
const size = Number(arg("size", "500"));
const seed = Number(arg("seed", "1"));
const minExact = Number(arg("min-exact", "0"));
const assetsDir = resolve(root, arg("assets", "build/assets"));
const dataDir = resolve(root, arg("data", "data/vpic"));
const outDir = resolve(root, arg("out", "build/parity"));
const goldenPath = arg("golden", "");
const goldenSize = Number(arg("golden-size", "300"));
const renamesPath = resolve(root, arg("renames", "data/vpic-known-renames.json"));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchBatch(entries: readonly CorpusEntry[]): Promise<Record<string, string>[]> {
  const data = entries.map((e) => (e.modelYear ? `${e.vin},${e.modelYear}` : e.vin)).join(";");
  const body = new URLSearchParams({ format: "json", data }).toString();
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(BATCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "nhtsa-edge-api-parity/1.0" },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { Results?: Record<string, string>[] };
      const results = json.Results ?? [];
      if (results.length !== entries.length) throw new Error(`expected ${entries.length} results, got ${results.length}`);
      return results;
    } catch (err) {
      if (attempt >= 4) throw err;
      console.warn(`  batch failed (${String(err)}), retry ${attempt}`);
      await sleep(PAUSE_MS * attempt * 2);
    }
  }
}

interface Mismatch {
  readonly vin: string;
  readonly modelYear?: number;
  readonly kind: string;
  readonly field: string;
  readonly local: string | null;
  readonly live: string | null;
}

async function main(): Promise<void> {
  const now = new Date();
  const corpus = buildCorpus(assetsDir, dataDir, size, seed, now);
  console.log(`Corpus: ${corpus.length} VINs (seed ${seed})`);

  const store = new VpicStore(fsAssetReader(assetsDir));
  const core = await store.getCore();

  const live: Record<string, string>[] = [];
  for (let i = 0; i < corpus.length; i += BATCH_SIZE) {
    const batch = corpus.slice(i, i + BATCH_SIZE);
    live.push(...(await fetchBatch(batch)));
    process.stdout.write(`  live ${Math.min(i + BATCH_SIZE, corpus.length)}/${corpus.length}\r`);
    await sleep(PAUSE_MS);
  }
  console.log();

  const renames = new RenameMatcher(loadKnownRenames(renamesPath));
  let allowlisted = 0;
  const mismatches: Mismatch[] = [];
  const fieldCounts = new Map<string, number>();
  const kindStats = new Map<string, { total: number; exact: number }>();
  const keysOnlyLive = new Set<string>();
  const keysOnlyLocal = new Set<string>();
  let exact = 0;
  let caseInsensitive = 0;
  const golden: Array<{ vin: string; modelYear?: number; kind: string; live: Record<string, string> }> = [];
  let localMs = 0;
  const yearStats = new Map<string, { total: number; exact: number }>();
  const yearBucket = (y: string | undefined): string => {
    const n = Number(y);
    if (!y || !Number.isFinite(n) || n === 0) return "unknown";
    if (n < 2010) return "< 2010";
    if (n < 2020) return "2010-2019";
    return String(n >= 2024 ? "2024+" : "2020-2023");
  };

  for (let i = 0; i < corpus.length; i++) {
    const entry = corpus[i] as CorpusEntry;
    const liveRow = live[i] ?? {};
    const started = performance.now();
    const decoded = await decodeVin(store, entry.vin, { modelYear: entry.modelYear ?? null, now });
    localMs += performance.now() - started;
    const localRow = toDecodeVinValues(decoded, liveRow["VIN"] ?? entry.vin);

    let vinOk = true;
    let vinOkWithRenames = true;
    let vinOkIgnoringCase = true;
    for (const field of new Set([...Object.keys(liveRow), ...Object.keys(localRow)])) {
      const a = localRow[field];
      const b = liveRow[field];
      if (a === undefined) keysOnlyLive.add(field);
      if (b === undefined) keysOnlyLocal.add(field);
      if (a === undefined || b === undefined) continue;
      renames.observe(entry.vin, field, a, b);
      if (a.trim().toLowerCase() !== b.trim().toLowerCase()) vinOkIgnoringCase = false;
      if (a.trim() !== b.trim()) {
        vinOk = false;
        if (!renames.explains(entry.vin, field, a, b)) vinOkWithRenames = false;
        fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
        mismatches.push({ vin: entry.vin, modelYear: entry.modelYear, kind: entry.kind, field, local: a, live: b });
      }
    }
    if (vinOk) exact++;
    else if (vinOkWithRenames) allowlisted++;
    if (vinOkIgnoringCase) caseInsensitive++;
    if (vinOk && golden.length < goldenSize) {
      const nonEmpty = Object.fromEntries(Object.entries(liveRow).filter(([, v]) => v.trim() !== ""));
      golden.push({ vin: entry.vin, modelYear: entry.modelYear, kind: entry.kind, live: nonEmpty });
    }
    const bucket = yearBucket(liveRow["ModelYear"]);
    const ys = yearStats.get(bucket) ?? { total: 0, exact: 0 };
    ys.total++;
    if (vinOk) ys.exact++;
    yearStats.set(bucket, ys);
    const stat = kindStats.get(entry.kind) ?? { total: 0, exact: 0 };
    stat.total++;
    if (vinOk) stat.exact++;
    kindStats.set(entry.kind, stat);
  }

  const exactRate = exact / Math.max(1, corpus.length);
  const allowlistedRate = allowlisted / Math.max(1, corpus.length);
  const gateRate = exactRate + allowlistedRate;
  const usedRenames = renames.usedEntries();
  const staleRenames = renames.staleEntries();
  const topFields = [...fieldCounts.entries()].sort((a, b) => b[1] - a[1]);

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "report.json"),
    JSON.stringify(
      {
        dumpVersion: core.dumpVersion,
        checkedAt: now.toISOString(),
        size: corpus.length,
        seed,
        exactRate,
        allowlistedMatches: allowlisted,
        allowlistedRate,
        gateRate,
        renamesUsed: usedRenames,
        renamesStale: staleRenames,
        caseInsensitiveRate: caseInsensitive / Math.max(1, corpus.length),
        byModelYear: Object.fromEntries(yearStats),
        avgLocalMs: localMs / Math.max(1, corpus.length),
        byKind: Object.fromEntries(kindStats),
        fieldMismatches: Object.fromEntries(topFields),
        keysOnlyLive: [...keysOnlyLive].sort(),
        keysOnlyLocal: [...keysOnlyLocal].sort(),
        mismatches,
      },
      null,
      2
    )
  );
  writeFileSync(
    join(outDir, "live-sample.json"),
    JSON.stringify({ dumpVersion: core.dumpVersion, fetchedAt: now.toISOString(), corpus, live }, null, 1)
  );

  const lines = [
    `## vPIC parity: offline decoder vs live API (${core.dumpVersion})`,
    ``,
    `- VINs checked: **${corpus.length}** (seed ${seed})`,
    `- Identical on every field (strict): **${(exactRate * 100).toFixed(2)}%** (${exact} VINs)`,
    `- Matching only through the known-renames allowlist: ${(allowlistedRate * 100).toFixed(2)}% (${allowlisted} VINs)`,
    `- Gate (strict + allowlisted): **${(gateRate * 100).toFixed(2)}%** (threshold ${(minExact * 100).toFixed(2)}%)`,
    `- Identical ignoring letter case: ${((caseInsensitive / Math.max(1, corpus.length)) * 100).toFixed(2)}% (live data gets re-cased after the dump is published)`,
    `- Average local decode: ${(localMs / Math.max(1, corpus.length)).toFixed(2)} ms`,
    ``,
    `| model year (live) | total | identical |`,
    `| --- | ---: | ---: |`,
    ...[...yearStats.entries()].sort().map(([k, s]) => `| ${k} | ${s.total} | ${s.exact} |`),
    ``,
    `| VIN kind | total | identical |`,
    `| --- | ---: | ---: |`,
    ...[...kindStats.entries()].map(([k, s]) => `| ${k} | ${s.total} | ${s.exact} |`),
    ``,
    `| field | mismatching VINs |`,
    `| --- | ---: |`,
    ...topFields.slice(0, 25).map(([f, n]) => `| ${f} | ${n} |`),
  ];
  if (usedRenames.length > 0) {
    lines.push("", "Known renames applied:", ...usedRenames.map((e) => `- ${describeRename(e)}`));
  }
  for (const e of staleRenames) {
    lines.push("", `- Stale known rename: ${describeRename(e)}. The dump already has the live value; remove this entry from data/vpic-known-renames.json.`);
    console.log(`::warning title=Stale vPIC known rename::${describeRename(e)} is already in the dump; remove it from data/vpic-known-renames.json`);
  }
  if (keysOnlyLive.size > 0) lines.push("", `Keys only in live output: ${[...keysOnlyLive].sort().join(", ")}`);
  if (keysOnlyLocal.size > 0) lines.push("", `Keys only in local output: ${[...keysOnlyLocal].sort().join(", ")}`);
  lines.push("", "<details><summary>Examples per field</summary>", "", "```");
  for (const [field] of topFields) {
    for (const m of mismatches.filter((x) => x.field === field).slice(0, 4)) {
      lines.push(`${m.vin}${m.modelYear ? `,${m.modelYear}` : ""} [${m.kind}] ${m.field}: local=${JSON.stringify(m.local)} live=${JSON.stringify(m.live)}`);
    }
  }
  lines.push("```", "</details>");
  if (keysOnlyLive.size > 0) {
    lines.push("", "<details><summary>Values of keys only in live output</summary>", "", "```");
    for (const key of [...keysOnlyLive].sort()) {
      const values = [...new Set(live.map((row) => row[key] ?? ""))].slice(0, 5);
      lines.push(`${key}: ${values.map((v) => JSON.stringify(v)).join(" | ")}`);
    }
    lines.push("```", "</details>");
  }

  if (goldenPath) {
    const target = resolve(root, goldenPath);
    mkdirSync(resolve(target, ".."), { recursive: true });
    writeFileSync(
      target,
      JSON.stringify({ dumpVersion: core.dumpVersion, source: "live vPIC DecodeVINValuesBatch", vins: golden }, null, 1) + "\n"
    );
    lines.push("", `Golden fixture: ${golden.length} VINs written to ${goldenPath}`);
  }

  const summary = lines.join("\n") + "\n";
  writeFileSync(join(outDir, "summary.md"), summary);
  const stepSummary = process.env["GITHUB_STEP_SUMMARY"];
  if (stepSummary) appendFileSync(stepSummary, summary);
  console.log(summary);

  if (gateRate < minExact) {
    console.error(`Parity ${(gateRate * 100).toFixed(2)}% (strict + allowlisted) is below the ${(minExact * 100).toFixed(2)}% threshold`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
