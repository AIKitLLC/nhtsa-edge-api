/**
 * Port of vpic.spvindecode (docs/vpic-reference/decode-functions.sql): runs the
 * decoding passes for the candidate model years, keeps the best pass, drops items
 * not yet QC'd, resolves lookup values and returns one row per decoded element.
 */

import { spvindecodeCore, type CorePassInput } from "./decode-core";
import { elementMap, nullsFirstDescNumber, pgInt } from "./items";
import type { VpicStore } from "./store";
import type { CoreAsset, DecodingItem, SchemaRecord, WmiRecord } from "./types";
import { vinDescriptor, vinModelYear2, vinWmi } from "./vin-functions";

export interface DecodedElement {
  readonly elementId: number;
  readonly variable: string;
  readonly code: string | null;
  readonly groupName: string | null;
  readonly dataType: string | null;
  readonly value: string | null;
  readonly attributeId: string | null;
  readonly source: string | null;
  readonly patternId: number | null;
  readonly vinSchemaId: number | null;
}

export interface DecodeResult {
  readonly vin: string;
  readonly dumpVersion: string;
  /** "Manu. Id" item (element 157, which has no row in vpic.Element). */
  readonly manufacturerId: string | null;
  /** Decode-able, public elements; `value` null when nothing was decoded for it. */
  readonly elements: readonly DecodedElement[];
}

export interface DecodeOptions {
  /** Model year supplied by the caller (the `year` parameter of spvindecode). */
  readonly modelYear?: number | null;
  readonly now?: Date;
}

const GROUP_ORDER: Readonly<Record<string, number>> = {
  "": 0,
  General: 1,
  "Exterior / Body": 2,
  "Exterior / Dimension": 3,
  "Exterior / Truck": 4,
  "Exterior / Trailer": 5,
  "Exterior / Wheel tire": 6,
  "Exterior / Motorcycle": 7,
  "Exterior / Bus": 8,
  Interior: 9,
  "Interior / Seat": 10,
  "Mechanical / Transmission": 11,
  "Mechanical / Drivetrain": 12,
  "Mechanical / Brake": 13,
  "Mechanical / Battery": 14,
  "Mechanical / Battery / Charger": 15,
  Engine: 16,
  "Passive Safety System": 17,
  "Passive Safety System / Air Bag Location": 18,
  "Active Safety System": 19,
  "Active Safety System / Maintaining Safe Distance": 20,
  "Active Safety System / Forward Collision Prevention": 21,
  "Active Safety System / Lane and Side Assist": 22,
  "Active Safety System / Backing Up and Parking": 23,
  "Active Safety System / 911 Notification": 24,
  "Active Safety System / Lighting Technologies": 25,
  Internal: 26,
};

function toTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

function errorValue(core: CoreAsset, codes: string | null): number {
  if (codes === null) return 0;
  const list = `,${codes},`;
  return core.errorCodes
    .filter((e) => list.includes(`,${e.id},`))
    .reduce((sum, e) => sum + (e.weight ?? 0), 0);
}

interface PassScore {
  readonly pass: number;
  readonly errorValue: number;
  readonly elementsWeight: number | null;
  readonly patterns: number | null;
  readonly modelYear: number | null;
}

function scorePass(core: CoreAsset, pass: number, items: readonly DecodingItem[], year: number | null): PassScore {
  const elements = elementMap(core);
  const codes = items.find((d) => d.elementId === 143)?.value ?? null;

  const weighted = new Map<number, number>();
  for (const d of items) {
    const weight = elements.get(d.elementId)?.weight ?? null;
    if ((d.value ?? "") !== "" && weight !== null) weighted.set(d.elementId, weight);
  }
  const patterns = items.filter(
    (d) =>
      (d.source === "Pattern" || d.source === "EngineModelPattern" || d.source === "Formula Pattern") &&
      !["", "Not Applicable"].includes(d.value ?? "")
  ).length;

  const myItem = items.find((d) => d.elementId === 29);
  const my = pgInt(myItem?.value ?? null);

  return {
    pass,
    errorValue: errorValue(core, codes),
    elementsWeight: weighted.size > 0 ? [...weighted.values()].reduce((a, b) => a + b, 0) : null,
    patterns: patterns > 0 ? patterns : null,
    modelYear: my === null ? null : my + (year !== null && year === my ? 10000 : 0),
  };
}

/** ORDER BY ErrorValue DESC, ElementsWeight DESC, Patterns DESC, ModelYear DESC (NULLs first). */
function compareScores(a: PassScore, b: PassScore): number {
  return (
    b.errorValue - a.errorValue ||
    nullsFirstDescNumber(a.elementsWeight, b.elementsWeight) ||
    nullsFirstDescNumber(a.patterns, b.patterns) ||
    nullsFirstDescNumber(a.modelYear, b.modelYear) ||
    a.pass - b.pass
  );
}

function schemasOfWmiInYear(wmi: WmiRecord | null, year: number): number {
  if (!wmi) return 0;
  return wmi.schemas.filter(([, from, to]) => year >= from && year <= (to ?? 2999)).length;
}

export async function decodeVin(store: VpicStore, rawVin: string, options: DecodeOptions = {}): Promise<DecodeResult> {
  const now = options.now ?? new Date();
  const year = options.modelYear ?? null;
  const core = await store.getCore();
  const vin = rawVin.trim().toUpperCase();
  if (vin.length > 17) throw new RangeError("VIN longer than 17 characters");

  const varWmi = vinWmi(vin);
  const wmi = await store.getWmi(varWmi);
  const vLimit = now.getUTCFullYear() + 2;

  // Plan the passes first (only needs the WMI record), so that only the schemas of
  // the candidate model years are loaded: large WMIs have hundreds of schemas.
  const dmy = core.vinDescriptors[vinDescriptor("")] ?? null; // descriptor of '' (see below)
  let rmy: number | null = null;
  let omy: number | null = null;
  let conclusive = true;
  if (!(dmy !== null && dmy >= 1980 && dmy <= vLimit)) {
    rmy = vinModelYear2(vin, wmi && wmi.wmi === varWmi ? wmi : null, now);
    if (rmy !== null && rmy < 0) {
      omy = -rmy - 30;
      rmy = -rmy;
      conclusive = false;
    }
    if (conclusive && rmy !== null) {
      let altMY: number | null = null;
      if (rmy >= 1980 && rmy <= vLimit - 30) altMY = rmy + 30;
      else if (rmy >= 1980 + 30 && rmy <= vLimit) altMY = rmy - 30;
      if (altMY !== null && altMY !== rmy) {
        const cnt1 = schemasOfWmiInYear(wmi, rmy);
        const cnt2 = schemasOfWmiInYear(wmi, altMY);
        if (cnt1 === 0 && cnt2 > 0) rmy = altMY;
      }
    }
  }
  const candidateYears: (number | null)[] =
    dmy !== null && dmy >= 1980 && dmy <= vLimit
      ? [dmy]
      : [rmy, ...(omy !== null ? [omy] : []), ...(year !== null && year >= 1980 && year <= vLimit ? [year] : [])];

  const schemaIds = (wmi?.schemas ?? [])
    .filter(([, from, to]) => candidateYears.some((y) => y === null || (y >= from && y <= (to ?? 2999))))
    .map(([id]) => id);
  const schemas: ReadonlyMap<number, SchemaRecord> = wmi ? await store.getSchemas(schemaIds) : new Map();

  const ctx = {
    core,
    wmi,
    schemas,
    nowTimestamp: toTimestamp(now),
    loadModelMakes: (schemaId: number, modelId: number) => store.getModelMakes(schemaId, modelId),
    loadSpecSchemas: (makeIds: readonly number[]) => store.getSpecSchemas(makeIds),
  };

  const passes = new Map<number, DecodingItem[]>();
  const run = async (input: CorePassInput): Promise<string> => {
    const result = await spvindecodeCore(input, ctx);
    passes.set(input.pass, result.items);
    return result.returnCode;
  };

  // The source computes the descriptor before `vin` is assigned, i.e. from '',
  // so this pass only runs if vpic.VinDescriptor ever lists '***********'.
  let modelYearSource = "***X*|Y";

  if (dmy !== null && dmy >= 1980 && dmy <= vLimit) {
    await run({ pass: 1, modelYear: dmy, vin, modelYearSource: vinDescriptor(""), conclusive: true, error12: year !== null && year !== dmy });
  } else {
    let do3and4 = true;
    if (year !== null && year >= 1980 && year <= vLimit) {
      if (year === rmy || year === omy) {
        do3and4 = true;
      } else {
        modelYearSource = String(year);
        const rc = await run({ pass: 2, modelYear: year, vin, modelYearSource, conclusive: true, error12: true });
        do3and4 = rc.includes(" 8 ") && rmy !== null;
      }
    }

    if (do3and4) {
      await run({ pass: 3, modelYear: rmy, vin, modelYearSource, conclusive, error12: year !== null && rmy !== null && year !== rmy });
      if (omy !== null) {
        await run({ pass: 4, modelYear: omy, vin, modelYearSource, conclusive, error12: year !== null && year !== omy });
      }
    }
  }

  // Best pass
  const scores = [...passes.entries()].map(([pass, items]) => scorePass(core, pass, items, year)).sort(compareScores);
  const best = scores[0]?.pass;
  let items = best !== undefined ? passes.get(best) ?? [] : [];

  // Items of schemas still to be QC'd are dropped
  const qcSources = ["pattern", "formula", "enginem", "convers"];
  for (const d of items) {
    const schema = d.vinSchemaId !== null ? schemas.get(d.vinSchemaId) : undefined;
    if (schema?.toBeQCed && qcSources.includes(d.source.substring(0, 7).toLowerCase())) d.toBeQCed = true;
  }
  items = items.filter((d) => d.toBeQCed !== true);

  // Resolve lookup placeholders (vpic.fElementAttributeValue, precomputed at build time)
  for (const d of items) {
    if (d.value === "XXX") d.value = d.resolved;
  }

  const clean = (v: string | null): string | null => (v === null ? null : v.replace(/[\t\r\n]/g, " "));

  const elements: DecodedElement[] = [];
  const sortedElements = [...core.elements]
    .filter((e) => (e.decode ?? "") !== "" && !e.isPrivate)
    .sort((a, b) => (GROUP_ORDER[a.groupName ?? ""] ?? 99) - (GROUP_ORDER[b.groupName ?? ""] ?? 99) || a.id - b.id);

  for (const e of sortedElements) {
    // Several rows only for multi-value elements; the live API lists them last-inserted
    // first (e.g. "All Bulk Deliver Trailer, Bulk Delivery Trailer"), verified by parity.
    const matches = items.filter((d) => d.elementId === e.id).sort((a, b) => b.seq - a.seq);
    if (matches.length === 0) {
      elements.push({ elementId: e.id, variable: e.name, code: e.code, groupName: e.groupName, dataType: e.dataType, value: null, attributeId: null, source: null, patternId: null, vinSchemaId: null });
      continue;
    }
    for (const d of matches) {
      elements.push({
        elementId: e.id,
        variable: e.name,
        code: e.code,
        groupName: e.groupName,
        dataType: e.dataType,
        value: clean(d.value),
        attributeId: d.attributeId,
        source: d.source,
        patternId: d.patternId,
        vinSchemaId: d.vinSchemaId,
      });
    }
  }

  const manufacturerId = items.find((d) => d.elementId === 157)?.value ?? null;
  return { vin, dumpVersion: core.dumpVersion, manufacturerId, elements };
}
