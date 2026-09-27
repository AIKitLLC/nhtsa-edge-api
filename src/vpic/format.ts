/**
 * Output shapes compatible with the public vPIC API
 * (https://vpic.nhtsa.dot.gov/api/): DecodeVinValues (flat) and DecodeVin (variable list).
 */

import type { DecodeResult, DecodedElement } from "./decode";

/** Joins the values of one element (several rows only for multi-value elements). */
function joinValues(rows: readonly DecodedElement[]): string {
  return rows
    .map((r) => r.value ?? "")
    .filter((v) => v !== "")
    .join("; ");
}

function groupByElement(result: DecodeResult): Map<number, DecodedElement[]> {
  const map = new Map<number, DecodedElement[]>();
  for (const row of result.elements) {
    let list = map.get(row.elementId);
    if (!list) map.set(row.elementId, (list = []));
    list.push(row);
  }
  return map;
}

/**
 * DecodeVinValues result object: one key per element code, "" when not decoded,
 * plus VIN, MakeID and ModelID.
 */
export function toDecodeVinValues(result: DecodeResult, searchVin: string): Record<string, string> {
  const out: Record<string, string> = {};
  let makeId = "";
  let modelId = "";

  for (const [elementId, rows] of groupByElement(result)) {
    const first = rows[0];
    if (!first?.code) continue;
    out[first.code] = joinValues(rows);
    if (elementId === 26) makeId = first.attributeId ?? "";
    if (elementId === 28) modelId = first.attributeId ?? "";
  }

  out["MakeID"] = makeId;
  out["ModelID"] = modelId;
  out["VIN"] = searchVin;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

export interface DecodeVinVariable {
  readonly Value: string | null;
  readonly ValueId: string | null;
  readonly Variable: string;
  readonly VariableId: number;
}

/** DecodeVin result rows: one per element (in output order). */
export function toDecodeVinVariables(result: DecodeResult): DecodeVinVariable[] {
  const rows: DecodeVinVariable[] = [];
  for (const [elementId, list] of groupByElement(result)) {
    const first = list[0];
    if (!first) continue;
    const value = joinValues(list);
    rows.push({
      Value: value === "" ? null : value,
      ValueId: value === "" ? null : first.attributeId ?? "",
      Variable: first.variable,
      VariableId: elementId,
    });
  }
  return rows;
}

export function vpicEnvelope<T>(searchCriteria: string, results: readonly T[]) {
  return {
    Count: results.length,
    Message: "Results returned successfully. NOTE: Any missing decoded values should be interpreted as NHTSA does not have data on the specific variable. Missing value should NOT be interpreted as an indication that a feature or technology is unavailable for a vehicle.",
    SearchCriteria: searchCriteria,
    Results: results,
  };
}
