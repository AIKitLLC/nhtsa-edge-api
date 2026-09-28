/**
 * Unified vehicle profile: the offline vPIC decode (always available, no network)
 * enriched in parallel with US EPA FuelEconomy.gov and EU RDW reference data.
 * An enrichment that fails only leaves its section empty; the decode never depends on it.
 */

import { fetchEpaEnergySpecs, type EpaEnergySpecs } from "../enrichment/epa";
import { fetchRdwEuropeanSpecs, type RdwEuropeanSpecs } from "../enrichment/rdw";
import type { EnrichmentOutcome, EnrichmentResult } from "../enrichment/types";
import type { V1VehicleSpec } from "../vpic/v1-format";

export interface UnifiedVehicleProfile {
  readonly vin: string;
  readonly make: string | null;
  readonly model: string | null;
  readonly year: number | null;
  readonly bodyClass: string | null;
  readonly vehicleType: string | null;
  readonly plantCountry: string | null;
  readonly manufacturer: string | null;
  readonly isValidVin: boolean;
  readonly engine: {
    readonly cylinders: number | null;
    readonly displacementL: number | null;
    readonly horsepower: number | null;
    readonly fuelType: string | null;
    readonly electrificationLevel: string | null;
  };
  readonly energy: EpaEnergySpecs | null;
  readonly europeanSpecs: RdwEuropeanSpecs | null;
  readonly provenance: {
    readonly primarySource: "LOCAL_VPIC";
    readonly dataVersion: string;
    readonly enrichment: { readonly epa: EnrichmentOutcome; readonly eu: EnrichmentOutcome };
    readonly enrichedSources: readonly string[];
    readonly resolvedAt: string;
  };
}

export interface UnifiedOptions {
  readonly enrichWithEpa?: boolean;
  readonly enrichWithEu?: boolean;
}

const skipped = <T>(): Promise<EnrichmentResult<T>> => Promise.resolve({ outcome: "skipped", data: null });

export async function resolveUnifiedVehicle(
  spec: V1VehicleSpec,
  dataVersion: string,
  options: UnifiedOptions = {}
): Promise<UnifiedVehicleProfile> {
  const { make, model, modelYear } = spec;
  const canEnrich = make !== null && model !== null;

  const [epa, eu] = await Promise.all([
    options.enrichWithEpa !== false && canEnrich && modelYear !== null
      ? fetchEpaEnergySpecs(make, model, modelYear)
      : skipped<EpaEnergySpecs>(),
    options.enrichWithEu !== false && canEnrich ? fetchRdwEuropeanSpecs(make, model) : skipped<RdwEuropeanSpecs>(),
  ]);

  const enrichedSources = [
    ...(epa.outcome === "matched" ? ["US_EPA_FUELECONOMY"] : []),
    ...(eu.outcome === "matched" ? ["EU_RDW_OPENDATA"] : []),
  ];

  return {
    vin: spec.vin,
    make,
    model,
    year: modelYear,
    bodyClass: spec.bodyClass,
    vehicleType: spec.vehicleType,
    plantCountry: spec.plantCountry,
    manufacturer: spec.manufacturer,
    isValidVin: spec.isCleanDecode,
    engine: {
      cylinders: spec.engineCylinders,
      displacementL: spec.displacementL,
      horsepower: spec.engineHp,
      fuelType: spec.fuelType,
      electrificationLevel: spec.electrificationLevel,
    },
    energy: epa.data,
    europeanSpecs: eu.data,
    provenance: {
      primarySource: "LOCAL_VPIC",
      dataVersion,
      enrichment: { epa: epa.outcome, eu: eu.outcome },
      enrichedSources,
      resolvedAt: new Date().toISOString(),
    },
  };
}

/** A profile is cacheable only when no enrichment failed transiently. */
export function isCacheable(profile: UnifiedVehicleProfile): boolean {
  const { epa, eu } = profile.provenance.enrichment;
  return epa !== "error" && eu !== "error";
}
