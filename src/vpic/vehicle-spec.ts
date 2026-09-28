/**
 * Vehicle Spec step of vpic.spvindecode_core (tbl_tmpPatterns / tbl_tmpPatternsEx /
 * tbl_tbl1): adds spec values (mostly safety equipment) for the decoded make, model,
 * vehicle type and model year when all key patterns of a spec group match.
 */

import type { DecodingItem, SpecSchema, WmiRecord } from "./types";

/** Elements that may hold several values; spec values may be added even when present. */
const MULTI_VALUE_ELEMENTS = new Set([1, 114, 121, 129, 150, 154, 155, 169, 186]);

export interface SpecCandidate {
  readonly elementId: number;
  readonly attributeId: string;
  readonly resolved: string | null;
  readonly changedOn: string | null;
  readonly groupId: number;
  readonly schemaId: number;
  readonly toBeQCed: boolean;
}

/** PostgreSQL `ORDER BY changedon DESC` puts NULLs first. */
function changedOnDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a > b ? -1 : 1;
}

export function vehicleSpecCandidates(
  specSchemas: readonly SpecSchema[],
  wmi: WmiRecord,
  vehicleTypeId: number | null,
  modelId: number | null,
  modelYear: number | null,
  passItems: readonly DecodingItem[]
): SpecCandidate[] {
  if (vehicleTypeId === null || modelId === null) return [];
  const wmiMakes = new Set(wmi.makes.map(([id]) => id));

  // tbl_tmpPatterns: spec groups of matching schemas (make via Wmi_Make, type, model, year)
  const groups: Array<{ schema: SpecSchema; group: SpecSchema["groups"][number] }> = [];
  for (const schema of specSchemas) {
    if (!wmiMakes.has(schema.makeId)) continue;
    if (schema.vehicleTypeId !== vehicleTypeId) continue;
    if (!schema.modelIds.includes(modelId)) continue;
    if (schema.years.length > 0 && (modelYear === null || !schema.years.includes(modelYear))) continue;
    if (schema.toBeQCed) continue; // includeNotPublicilyAvailable is never true
    for (const group of schema.groups) groups.push({ schema, group });
  }

  // tbl_tmpPatternsEx: drop groups where any key pattern has no matching decoding item
  const matching = groups.filter(({ group }) => {
    let total = 0;
    const matchedItems = new Set<number>();
    for (const [elementId, attributeId] of group.keys) {
      const hits = passItems.filter(
        (d) => d.elementId === elementId && (d.attributeId ?? "").toLowerCase() === attributeId.toLowerCase()
      );
      total += Math.max(1, hits.length);
      for (const d of hits) matchedItems.add(d.seq);
    }
    return total === matchedItems.size;
  });

  // tbl_tbl1: non-key values whose element is not already decoded (multi-value elements excepted)
  const present = new Set(passItems.filter((d) => !MULTI_VALUE_ELEMENTS.has(d.elementId)).map((d) => d.elementId));
  const seen = new Set<string>();
  const candidates: SpecCandidate[] = [];
  for (const { schema, group } of matching) {
    for (const [elementId, attributeId, resolved, changedOn] of group.values) {
      if (present.has(elementId)) continue;
      // SELECT DISTINCT over (iskey, schema, group, element, attribute, changedon, tobeqced)
      const key = `${schema.id}|${group.id}|${elementId}|${attributeId}|${changedOn}|${schema.toBeQCed}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({ elementId, attributeId, resolved, changedOn, groupId: group.id, schemaId: schema.id, toBeQCed: schema.toBeQCed });
    }
  }

  // Keep one row per element: ROW_NUMBER() OVER (PARTITION BY elementid ORDER BY ChangedOn DESC)
  const byElement = new Map<number, SpecCandidate>();
  const ordered = [...candidates].sort((a, b) => changedOnDesc(a.changedOn, b.changedOn));
  for (const c of ordered) {
    if (!byElement.has(c.elementId)) byElement.set(c.elementId, c);
  }
  return [...byElement.values()];
}
