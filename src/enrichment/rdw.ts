/**
 * Netherlands RDW Open Data enrichment (dataset m9d7-ebf2, registered vehicles).
 * RDW has no VIN search, so this is one registration of the same make and trade
 * name: type approval, category and masses are model-level reference values.
 * Per-vehicle fields of that registration (e.g. its open-recall flag) are
 * deliberately not returned: they describe another vehicle.
 */

import { fetchJson, positiveInt, type EnrichmentResult } from "./types";

const DATASET = "https://opendata.rdw.nl/resource/m9d7-ebf2.json";

export interface RdwEuropeanSpecs {
  readonly euTypeApprovalNumber?: string;
  readonly europeanVehicleCategory?: string;
  readonly curbWeightKg?: number;
  readonly grossVehicleWeightKg?: number;
  readonly maxTowingWeightUnbrakedKg?: number;
  readonly wheelbaseCm?: number;
  readonly matchLevel: "make-model";
}

export async function fetchRdwEuropeanSpecs(make: string, model: string): Promise<EnrichmentResult<RdwEuropeanSpecs>> {
  try {
    const query = new URLSearchParams({
      merk: make.toUpperCase().trim(),
      handelsbenaming: model.toUpperCase().trim(),
      $limit: "1",
    });
    const [r] = await fetchJson<Array<Record<string, string>>>(`${DATASET}?${query.toString()}`);
    if (!r) return { outcome: "no-match", data: null };

    return {
      outcome: "matched",
      data: {
        euTypeApprovalNumber: r["typegoedkeuringsnummer"] || undefined,
        europeanVehicleCategory: r["europese_voertuigcategorie"] || undefined,
        curbWeightKg: positiveInt(r["massa_ledig_voertuig"]),
        grossVehicleWeightKg: positiveInt(r["toegestane_maximum_massa_voertuig"]),
        maxTowingWeightUnbrakedKg: positiveInt(r["maximum_massa_trekken_ongeremd"]),
        wheelbaseCm: positiveInt(r["wielbasis"]),
        matchLevel: "make-model",
      },
    };
  } catch {
    return { outcome: "error", data: null };
  }
}
