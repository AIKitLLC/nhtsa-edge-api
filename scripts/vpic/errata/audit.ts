#!/usr/bin/env bun
/**
 * Audits the NHTSA vPIC dump (restored by sql-verify/load-db.ts) for defects in its
 * data and decode functions, and, with --live, checks each finding against the live
 * vPIC API to tell dump-only defects from ones the live service shares.
 *
 * Usage: bun scripts/vpic/errata/audit.ts [--db=postgres://...] [--live] [--out=build/errata]
 * Writes <out>/report.json and <out>/report.md (also appended to GITHUB_STEP_SUMMARY).
 * Informational: always exits 0 unless the audit itself fails.
 */

import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { SQL } from "bun";
import { vinCheckDigit } from "../../../src/vpic/vin-functions";

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}

const root = resolve(import.meta.dirname ?? ".", "../../..");
const dbUrl = arg("db", process.env["DATABASE_URL"] ?? "postgres://postgres@localhost:5433/postgres");
const outDir = resolve(root, arg("out", "build/errata"));
const live = process.argv.includes("--live");
const sql = new SQL(dbUrl, { max: 4 });

interface Finding {
  readonly id: string;
  readonly title: string;
  readonly kind: "code" | "data" | "compliance";
  readonly count: number;
  readonly examples: readonly unknown[];
  live?: readonly unknown[];
}

/** Places a valid check digit at position 9 of a 17-character VIN. */
const withCheckDigit = (vin: string): string => `${vin.substring(0, 8)}${vinCheckDigit(vin)}${vin.substring(9)}`;

async function liveDecode(vins: readonly string[]): Promise<Record<string, string>[]> {
  const body = new URLSearchParams({ format: "json", data: vins.join(";") }).toString();
  const res = await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "nhtsa-edge-api-errata/1.0" },
    body,
  });
  if (!res.ok) throw new Error(`live API HTTP ${res.status}`);
  return ((await res.json()) as { Results: Record<string, string>[] }).Results;
}

async function sqlValue(vin: string, code: string): Promise<string | null> {
  const [row] = (await sql`SELECT value FROM vpic.spvindecode(${vin}) WHERE code = ${code}`) as Array<{ value: string | null }>;
  return row?.value ?? null;
}

const findings: Finding[] = [];

// E1. spvindecode computes var_descriptor before `vin` is assigned (from ''), so the
//     VinDescriptor model-year overrides never apply.
{
  const rows = (await sql`SELECT descriptor, modelyear FROM vpic.vindescriptor ORDER BY id`) as Array<{
    descriptor: string;
    modelyear: number;
  }>;
  const affected: Array<{ vin: string; descriptorYear: number; decodedYear: string | null }> = [];
  for (const r of rows) {
    const vin = withCheckDigit(`${r.descriptor}${"1".repeat(17)}`.substring(0, 17).replace("*", "0"));
    const decodedYear = await sqlValue(vin, "ModelYear");
    if (decodedYear !== String(r.modelyear)) affected.push({ vin, descriptorYear: r.modelyear, decodedYear });
  }
  const f: Finding = {
    id: "E1",
    kind: "code",
    title: "spvindecode ignores vpic.VinDescriptor model-year overrides (descriptor computed from an empty VIN)",
    count: affected.length,
    examples: affected,
  };
  if (live && affected.length > 0) {
    const results = await liveDecode(affected.map((a) => a.vin));
    f.live = results.map((r) => ({ vin: r["VIN"], liveModelYear: r["ModelYear"], liveErrorCode: r["ErrorCode"] }));
  }
  findings.push(f);
}

// E2. WMIs containing I, O or Q, which 49 CFR 565.15 excludes from every VIN position.
//     Registered as submitted: they describe non-compliant VINs, not a dump defect.
{
  const rows = (await sql`
    SELECT w.wmi, m.name AS manufacturer, w.publicavailabilitydate::date::text AS public_from
    FROM vpic.wmi w JOIN vpic.manufacturer m ON m.id = w.manufacturerid
    WHERE w.wmi ~ '[IOQ]' ORDER BY w.wmi`) as unknown[];
  findings.push({ id: "E2", kind: "compliance", title: "WMIs containing I, O or Q (non-compliant with 49 CFR 565.15)", count: rows.length, examples: rows });
}

// E3. Pattern keys with a literal I, O or Q outside brackets: they only match VINs that
//     violate 49 CFR 565.15, as manufacturers submitted them (not a dump defect).
{
  const rows = (await sql`
    SELECT e.name AS element, count(*)::int AS patterns, count(DISTINCT p.vinschemaid)::int AS schemas,
           (array_agg(p.keys ORDER BY p.id))[1:3] AS sample_keys
    FROM vpic.pattern p JOIN vpic.element e ON e.id = p.elementid
    WHERE regexp_replace(p.keys, '\\[[^]]*\\]', '', 'g') ~ '[IOQ]'
    GROUP BY e.name ORDER BY 2 DESC`) as Array<{ patterns: number }>;
  findings.push({
    id: "E3",
    kind: "compliance",
    title: "Pattern keys with a literal I, O or Q (match only non-compliant VINs)",
    count: rows.reduce((n, r) => n + r.patterns, 0),
    examples: rows,
  });
}

// E4. Lookup references to rows that are not in the dump
{
  const rows = (await sql`
    SELECT p.id AS pattern_id, vs.name AS schema, p.keys, e.name AS element, p.attributeid,
           (SELECT string_agg(w.wmi, ',') FROM vpic.wmi_vinschema x JOIN vpic.wmi w ON w.id = x.wmiid WHERE x.vinschemaid = p.vinschemaid) AS wmis,
           (SELECT min(x.yearfrom) FROM vpic.wmi_vinschema x WHERE x.vinschemaid = p.vinschemaid) AS year_from
    FROM vpic.pattern p JOIN vpic.element e ON e.id = p.elementid JOIN vpic.vinschema vs ON vs.id = p.vinschemaid
    WHERE e.lookuptable IS NOT NULL AND e.id NOT IN (96, 97, 98)
      AND vpic.felementattributevalue(p.elementid, p.attributeid) IS NULL`) as Array<Record<string, string>>;
  const f: Finding = { id: "E4", kind: "data", title: "Patterns whose lookup value is missing from the dump", count: rows.length, examples: rows };
  // A VIN that hits the pattern: WMI + literal keys at positions 4.., model-year code of year_from
  const yearCode = (y: number) => "ABCDEFGHJKLMNPRSTVWXY123456789".charAt(y - 2010);
  const probes = rows
    .filter((r) => /^[A-HJ-NPR-Z0-9]{1,5}$/.test(r["keys"] ?? "") && r["wmis"] && Number(r["year_from"]) >= 2010)
    .map((r) => {
      const vds = `${r["keys"]}00000`.substring(0, 5);
      return { patternId: r["pattern_id"], vin: withCheckDigit(`${(r["wmis"] ?? "").split(",")[0]}${vds}0${yearCode(Number(r["year_from"]))}1000001`) };
    });
  if (live && probes.length > 0) {
    const results = await liveDecode(probes.map((p) => p.vin));
    f.live = results.map((r, i) => ({ ...probes[i], liveMake: r["Make"], liveModel: r["Model"], liveModelId: r["ModelID"] }));
    const dumpModels = await Promise.all(probes.map(async (p) => ({ vin: p.vin, dumpModel: await sqlValue(p.vin, "Model") })));
    f.live = [...f.live, ...dumpModels];
  }
  findings.push(f);
}

// E5. VIN schemas no WMI uses (dead data)
{
  const rows = (await sql`
    SELECT vs.id, vs.name, (SELECT count(*)::int FROM vpic.pattern p WHERE p.vinschemaid = vs.id) AS patterns
    FROM vpic.vinschema vs
    WHERE NOT EXISTS (SELECT 1 FROM vpic.wmi_vinschema w WHERE w.vinschemaid = vs.id) ORDER BY vs.id`) as unknown[];
  findings.push({ id: "E5", kind: "data", title: "VIN schemas not linked to any WMI (never used)", count: rows.length, examples: rows });
}

await sql.close();

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "report.json"), `${JSON.stringify(findings, null, 2)}\n`);
const md = [
  "## vPIC dump audit",
  "",
  "| Id | Kind | Finding | Count |",
  "| :-- | :-- | :-- | --: |",
  ...findings.map((f) => `| ${f.id} | ${f.kind} | ${f.title} | ${f.count} |`),
  "",
  ...findings
    .filter((f) => f.live)
    .map((f) => `**${f.id} on the live API:**\n\n\`\`\`json\n${JSON.stringify({ dump: f.examples, live: f.live }, null, 1)}\n\`\`\``),
].join("\n");
writeFileSync(join(outDir, "report.md"), `${md}\n`);
if (process.env["GITHUB_STEP_SUMMARY"]) appendFileSync(process.env["GITHUB_STEP_SUMMARY"], `${md}\n`);
console.log(md);
console.log(JSON.stringify(findings, null, 1));
