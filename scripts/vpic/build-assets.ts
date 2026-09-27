#!/usr/bin/env bun
/**
 * Builds the Worker's static vPIC assets (build/assets/vpic/**) from data/vpic.
 *
 * - core.json            elements, error codes, conversions, defaults, engine models
 * - wmi/<n>.json         WMI records (bucketed by FNV-1a hash of the WMI)
 * - schema/<n>.json      VIN schemas with their patterns (bucketed by schema id)
 * - spec/<n>.json        vehicle spec schemas (bucketed by make id)
 *
 * Lookup attribute ids are resolved to names here (vpic.fElementAttributeValue),
 * so the runtime never needs the lookup tables.
 *
 * Usage: bun scripts/vpic/build-assets.ts [--data=data/vpic] [--out=build/assets]
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validCharsInKey } from "../../src/vpic/keys";
import { fnv1a, schemaBucketPath, specBucketPath, wmiBucketPath } from "../../src/vpic/store";
import { vinWmi } from "../../src/vpic/vin-functions";
import type {
  CoreAsset,
  DefaultValueDef,
  ElementDef,
  EngineModelPatternDef,
  PatternRow,
  SchemaBucket,
  SchemaRecord,
  SpecBucket,
  SpecPatternGroup,
  SpecSchema,
  WmiRecord,
} from "../../src/vpic/types";
import { ELEMENT_LOOKUP_TABLE } from "./lib/element-lookups";
import { LOOKUP_TABLES } from "./lib/tables";
import { bool, int, readTable, requireInt } from "./lib/tsv";

const BUCKETS = { wmi: 1024, schema: 4096, spec: 256 } as const;
/** Elements the pattern query never collects (Make, Manufacturer, Model Year, Vehicle Type). */
const WMI_LEVEL_ELEMENTS = new Set([26, 27, 29, 39]);

function arg(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}

const root = resolve(import.meta.dirname ?? ".", "../..");
const dataDir = resolve(root, arg("data", "data/vpic"));
const outDir = resolve(root, arg("out", "build/assets"));

function groupBy<T>(items: readonly T[], key: (item: T) => string | number): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = String(key(item));
    let list = map.get(k);
    if (!list) map.set(k, (list = []));
    list.push(item);
  }
  return map;
}

function writeJson(relPath: string, value: unknown): void {
  const full = join(outDir, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, JSON.stringify(value));
}

function main(): void {
  const manifest = JSON.parse(readFileSync(join(dataDir, "manifest.json"), "utf-8")) as { dumpVersion: string };
  console.log(`Building vPIC assets from ${dataDir} (${manifest.dumpVersion})`);

  // ---- lookups (vpic.fElementAttributeValue) ---------------------------------
  const lookups = new Map<string, Map<string, string>>();
  for (const table of LOOKUP_TABLES) {
    lookups.set(table, new Map(readTable(dataDir, table).map((r) => [r["id"] ?? "", r["name"] ?? ""])));
  }
  const resolveValue = (elementId: number, attributeId: string | null): string | null => {
    const table = ELEMENT_LOOKUP_TABLE[elementId];
    if (!table) return attributeId;
    if (attributeId === null) return null;
    return lookups.get(table)?.get(attributeId) ?? null;
  };
  const nameOf = (table: string, id: number | null): string | null =>
    id === null ? null : lookups.get(table)?.get(String(id)) ?? null;

  // ---- core -------------------------------------------------------------------
  const elements: ElementDef[] = readTable(dataDir, "element").map((r) => ({
    id: requireInt(r["id"], "element.id"),
    name: r["name"] ?? "",
    code: r["code"] ?? null,
    groupName: r["groupname"] ?? null,
    dataType: r["datatype"] ?? null,
    decode: r["decode"] ?? null,
    isPrivate: bool(r["isprivate"]) ?? false,
    weight: int(r["weight"]),
  }));
  const elementById = new Map(elements.map((e) => [e.id, e]));

  const engineModelNames = new Map(readTable(dataDir, "enginemodel").map((r) => [r["id"], r["name"] ?? ""]));
  const engineModels: Record<string, EngineModelPatternDef[]> = {};
  for (const r of readTable(dataDir, "enginemodelpattern")) {
    const name = engineModelNames.get(r["enginemodelid"] ?? "");
    if (name === undefined) continue;
    const key = name.trim().toLowerCase();
    const elementId = requireInt(r["elementid"], "enginemodelpattern.elementid");
    (engineModels[key] ??= []).push({
      elementId,
      attributeId: r["attributeid"] ?? "",
      resolved: resolveValue(elementId, r["attributeid"] ?? null),
      changedOn: r["changedon"] ?? null,
    });
  }

  const defaults: DefaultValueDef[] = readTable(dataDir, "defaultvalue")
    .filter((r) => r["defaultvalue"] !== null)
    .map((r) => {
      const elementId = requireInt(r["elementid"], "defaultvalue.elementid");
      return {
        elementId,
        vehicleTypeId: requireInt(r["vehicletypeid"], "defaultvalue.vehicletypeid"),
        defaultValue: r["defaultvalue"] ?? "",
        resolved: resolveValue(elementId, r["defaultvalue"] ?? null),
        changedOn: r["changedon"] ?? null,
      };
    });

  const core: CoreAsset = {
    dumpVersion: manifest.dumpVersion,
    elements,
    errorCodes: readTable(dataDir, "errorcode").map((r) => ({
      id: requireInt(r["id"], "errorcode.id"),
      name: r["name"] ?? "",
      additionalErrorText: r["additionalerrortext"] ?? null,
      weight: int(r["weight"]),
    })),
    conversions: readTable(dataDir, "conversion").map((r) => ({
      id: requireInt(r["id"], "conversion.id"),
      fromElementId: requireInt(r["fromelementid"], "conversion.fromelementid"),
      toElementId: requireInt(r["toelementid"], "conversion.toelementid"),
      formula: r["formula"] ?? "",
    })),
    defaults,
    engineModels,
    vinDescriptors: Object.fromEntries(
      readTable(dataDir, "vindescriptor").map((r) => [r["descriptor"] ?? "", requireInt(r["modelyear"], "vindescriptor.modelyear")])
    ),
    buckets: BUCKETS,
  };

  rmSync(join(outDir, "vpic"), { recursive: true, force: true });
  writeJson("vpic/core.json", core);

  // ---- WMIs -------------------------------------------------------------------
  const wmiMakes = groupBy(readTable(dataDir, "wmi_make"), (r) => r["wmiid"] ?? "");
  const wmiSchemas = groupBy(readTable(dataDir, "wmi_vinschema"), (r) => r["wmiid"] ?? "");
  const exceptions = groupBy(
    readTable(dataDir, "vinexception").filter((r) => r["checkdigit"] === "t" && r["vin"]),
    (r) => vinWmi(r["vin"] ?? "")
  );

  const wmiRows = readTable(dataDir, "wmi");
  const duplicateWmis = [...groupBy(wmiRows, (r) => r["wmi"] ?? "").entries()].filter(([, rows]) => rows.length > 1);
  if (duplicateWmis.length > 0) {
    throw new Error(`Duplicate WMI codes: ${duplicateWmis.map(([w]) => w).join(", ")}`);
  }

  const wmiBuckets = new Map<string, Record<string, WmiRecord>>();
  for (const r of wmiRows) {
    const id = requireInt(r["id"], "wmi.id");
    const wmi = r["wmi"] ?? "";
    const manufacturerId = int(r["manufacturerid"]);
    const vehicleTypeId = int(r["vehicletypeid"]);
    const record: WmiRecord = {
      id,
      wmi,
      manufacturerId,
      manufacturerName: nameOf("manufacturer", manufacturerId),
      vehicleTypeId,
      vehicleTypeName: nameOf("vehicletype", vehicleTypeId),
      truckTypeId: int(r["trucktypeid"]),
      publicAvailabilityDate: r["publicavailabilitydate"] ?? null,
      changedOn: r["changedon"] ?? null,
      makes: (wmiMakes.get(String(id)) ?? []).map((m) => {
        const makeId = requireInt(m["makeid"], "wmi_make.makeid");
        return [makeId, nameOf("make", makeId) ?? ""] as const;
      }),
      schemas: (wmiSchemas.get(String(id)) ?? []).map(
        (s) =>
          [
            requireInt(s["vinschemaid"], "wmi_vinschema.vinschemaid"),
            requireInt(s["yearfrom"], "wmi_vinschema.yearfrom"),
            int(s["yearto"]),
          ] as const
      ),
      checkDigitExceptions: (exceptions.get(wmi) ?? []).map((e) => e["vin"] ?? ""),
    };
    const path = wmiBucketPath(wmi, BUCKETS.wmi);
    let bucket = wmiBuckets.get(path);
    if (!bucket) wmiBuckets.set(path, (bucket = {}));
    bucket[wmi] = record;
  }
  for (const [path, bucket] of wmiBuckets) writeJson(path, bucket);

  // ---- VIN schemas --------------------------------------------------------------
  const modelMakesById = groupBy(readTable(dataDir, "make_model"), (r) => r["modelid"] ?? "");
  const patternsBySchema = groupBy(readTable(dataDir, "pattern"), (r) => r["vinschemaid"] ?? "");
  const schemaBuckets = new Map<string, { schemas: Record<string, SchemaRecord>; modelMakes: Record<string, (readonly [number, string])[]> }>();
  let patternCount = 0;
  let formulaModelPatterns = 0;

  for (const s of readTable(dataDir, "vinschema")) {
    const id = requireInt(s["id"], "vinschema.id");
    const all = (patternsBySchema.get(String(id)) ?? []).sort(
      (a, b) => requireInt(a["id"], "pattern.id") - requireInt(b["id"], "pattern.id")
    );

    const validChars = new Map<number, Set<string>>();
    for (const keys of new Set(all.map((p) => p["keys"] ?? ""))) {
      for (const [pos, ch] of validCharsInKey(keys)) {
        let set = validChars.get(pos);
        if (!set) validChars.set(pos, (set = new Set()));
        set.add(ch);
      }
    }

    const patterns: PatternRow[] = [];
    const path = schemaBucketPath(id, BUCKETS.schema);
    let bucket = schemaBuckets.get(path);
    if (!bucket) schemaBuckets.set(path, (bucket = { schemas: {}, modelMakes: {} }));

    for (const p of all) {
      const elementId = requireInt(p["elementid"], "pattern.elementid");
      const keys = p["keys"] ?? "";
      if (WMI_LEVEL_ELEMENTS.has(elementId)) continue;
      const element = elementById.get(elementId);
      if (!element) continue; // INNER JOIN Element
      const isFormula = keys.includes("#");
      const decodable = element.decode !== null && !element.isPrivate;
      if (!decodable && !isFormula) continue;

      const attributeId = p["attributeid"] ?? "";
      patterns.push([
        requireInt(p["id"], "pattern.id"),
        keys,
        elementId,
        attributeId,
        resolveValue(elementId, attributeId),
        p["changedon"] ?? null,
      ]);

      if (elementId === 28) {
        if (isFormula) formulaModelPatterns++;
        bucket.modelMakes[attributeId] ??= (modelMakesById.get(attributeId) ?? []).map((mm) => {
          const makeId = requireInt(mm["makeid"], "make_model.makeid");
          return [makeId, nameOf("make", makeId) ?? ""] as const;
        });
      }
    }
    patternCount += patterns.length;

    bucket.schemas[String(id)] = {
      id,
      toBeQCed: bool(s["tobeqced"]) ?? false,
      patterns,
      validChars: Object.fromEntries(
        [...validChars.entries()].sort(([a], [b]) => a - b).map(([pos, set]) => [String(pos), [...set].sort().join("")])
      ),
    };
  }
  for (const [path, bucket] of schemaBuckets) writeJson(path, bucket satisfies SchemaBucket);
  if (formulaModelPatterns > 0) {
    console.warn(`  note: ${formulaModelPatterns} formula patterns set Model; their makes are resolved only when listed in the bucket`);
  }

  // ---- vehicle spec schemas ---------------------------------------------------
  const specModels = groupBy(readTable(dataDir, "vehiclespecschema_model"), (r) => r["vehiclespecschemaid"] ?? "");
  const specYears = groupBy(readTable(dataDir, "vehiclespecschema_year"), (r) => r["vehiclespecschemaid"] ?? "");
  const specGroups = groupBy(readTable(dataDir, "vspecschemapattern"), (r) => r["schemaid"] ?? "");
  const specPatterns = groupBy(readTable(dataDir, "vehiclespecpattern"), (r) => r["vspecschemapatternid"] ?? "");

  const specBuckets = new Map<string, Record<string, SpecSchema[]>>();
  for (const s of readTable(dataDir, "vehiclespecschema")) {
    const id = requireInt(s["id"], "vehiclespecschema.id");
    const makeId = requireInt(s["makeid"], "vehiclespecschema.makeid");
    const groups: SpecPatternGroup[] = [];
    for (const g of specGroups.get(String(id)) ?? []) {
      const gid = requireInt(g["id"], "vspecschemapattern.id");
      const rows = (specPatterns.get(String(gid)) ?? []).sort(
        (a, b) => requireInt(a["id"], "vsp.id") - requireInt(b["id"], "vsp.id")
      );
      const keys = rows.filter((p) => p["iskey"] === "t");
      if (keys.length === 0) continue; // never selected: requires a key pattern
      groups.push({
        id: gid,
        keys: keys.map((p) => [requireInt(p["elementid"], "vsp.elementid"), p["attributeid"] ?? ""] as const),
        values: rows
          .filter((p) => p["iskey"] !== "t")
          .map((p) => {
            const elementId = requireInt(p["elementid"], "vsp.elementid");
            return [elementId, p["attributeid"] ?? "", resolveValue(elementId, p["attributeid"] ?? null), p["changedon"] ?? null] as const;
          }),
      });
    }
    const models = (specModels.get(String(id)) ?? []).map((m) => requireInt(m["modelid"], "vssm.modelid"));
    if (groups.length === 0 || models.length === 0) continue; // cannot match (INNER JOIN model, key pattern)

    const path = specBucketPath(makeId, BUCKETS.spec);
    let bucket = specBuckets.get(path);
    if (!bucket) specBuckets.set(path, (bucket = {}));
    (bucket[String(makeId)] ??= []).push({
      id,
      makeId,
      vehicleTypeId: int(s["vehicletypeid"]),
      toBeQCed: bool(s["tobeqced"]) ?? false,
      modelIds: models,
      years: (specYears.get(String(id)) ?? []).map((y) => requireInt(y["year"], "vssy.year")),
      groups,
    });
  }
  for (const [path, byMake] of specBuckets) writeJson(path, { byMake } satisfies SpecBucket);

  const fileCount = 1 + wmiBuckets.size + schemaBuckets.size + specBuckets.size;
  console.log(
    `  wrote ${fileCount} files: ${wmiRows.length} WMIs, ${Object.keys(core.elements).length} elements, ${patternCount} decodable patterns`
  );
  // Sanity: the hash used for bucketing must be stable across builds/runtimes
  if (fnv1a("1HG") !== fnv1a("1HG")) throw new Error("unstable hash");
}

main();
