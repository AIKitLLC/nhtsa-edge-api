#!/usr/bin/env bun
/**
 * Parity check: parsed Form 144 records in data/form144 vs the SEC EDGAR daily index.
 *
 * For each sampled day, the index's unique 144/144-A accession count is the ground
 * truth (the index lists every filing twice, once per filer, so lines are not
 * filings). A parsed record below 100% means a filing's submission carried no
 * parseable XML block; those accessions are listed in the day file's `failed`.
 *
 * Usage: bun scripts/form144/parity.ts [--days=3] [--min=0.85] [--data=data/form144] [--out=build/parity-form144]
 * Writes <out>/report.json and <out>/summary.md. Exits non-zero below --min.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Form144Day, Form144Manifest } from "../../src/form144/store";
import { USER_AGENT, indexUrl, parseIndex } from "./ingest";

const arg = (name: string, fallback: string): string =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const root = resolve(import.meta.dirname ?? ".", "../..");
const dataDir = resolve(root, arg("data", "data/form144"));
const outDir = resolve(root, arg("out", "build/parity-form144"));
const sampleDays = Number(arg("days", "3"));
const min = Number(arg("min", "0.85"));

async function main(): Promise<void> {
  const manifest = JSON.parse(readFileSync(join(dataDir, "manifest.json"), "utf-8")) as Form144Manifest;
  const sampled = manifest.days.slice(-sampleDays);
  if (sampled.length === 0) throw new Error("manifest has no days to sample");

  const rows: { date: string; index: number; parsed: number; rate: number }[] = [];
  for (const { date } of sampled) {
    const res = await fetch(indexUrl(date), { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) throw new Error(`index for ${date}: HTTP ${res.status}`);
    const indexCount = parseIndex(await res.text()).length;
    const dayPath = join(dataDir, "days", `${date}.json`);
    const parsed = existsSync(dayPath) ? (JSON.parse(readFileSync(dayPath, "utf-8")) as Form144Day).notices.length : 0;
    rows.push({ date, index: indexCount, parsed, rate: indexCount === 0 ? 1 : parsed / indexCount });
    await new Promise((r) => setTimeout(r, 200));
  }

  const totalIndex = rows.reduce((n, r) => n + r.index, 0);
  const totalParsed = rows.reduce((n, r) => n + r.parsed, 0);
  const rate = totalIndex === 0 ? 1 : totalParsed / totalIndex;

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, "report.json"),
    JSON.stringify({ checkedAt: new Date().toISOString(), min, rate, totalIndex, totalParsed, days: rows }, null, 2) + "\n"
  );
  const lines = [
    `## Form 144 parity: parsed records vs the EDGAR daily index`,
    ``,
    `- Days sampled: **${rows.length}** (the most recent in the cache)`,
    `- Parsed / index (unique accessions): **${totalParsed}/${totalIndex} = ${(rate * 100).toFixed(2)}%** (threshold ${(min * 100).toFixed(0)}%)`,
    ``,
    `| filing day | index (unique) | parsed | rate |`,
    `| --- | ---: | ---: | ---: |`,
    ...rows.map((r) => `| ${r.date} | ${r.index} | ${r.parsed} | ${(r.rate * 100).toFixed(2)}% |`),
    ``,
  ];
  const summary = lines.join("\n");
  writeFileSync(join(outDir, "summary.md"), summary);
  const stepSummary = process.env["GITHUB_STEP_SUMMARY"];
  if (stepSummary) appendFileSync(stepSummary, summary);
  console.log(summary);

  if (rate < min) {
    console.error(`Parity ${(rate * 100).toFixed(2)}% is below the ${(min * 100).toFixed(0)}% threshold`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
