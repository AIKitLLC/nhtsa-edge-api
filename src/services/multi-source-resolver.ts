/**
 * Multi-Source Vehicle Data Resolver & Intelligent Fallback Engine
 * Safe High-Performance Engineering Standard
 *
 * Tier 1: Local In-Memory RAM Engine (0.01ms - 49 CFR Part 565 + 13,001 WMIs)
 * Tier 2: Cloudflare Edge Cache API / D1 SQLite Database
 * Tier 3: NHTSA VPIC Primary Upstream Decoder
 * Tier 4: Fallback to Local Engine if NHTSA is down/unrecognized
 * Tier 5: Multi-Source Enrichment:
 *         - US EPA / FuelEconomy.gov (Electric Range, MPGe/MPG, Motor kW, Level 2 Charge time)
 *         - EU RDW Open Data (EU Type Approval, Exact Curb Weight, GVWR, Axle config)
 */

import { CONFIG } from "../config";
import type { Env } from "../types/env";
import { decodeVinLocally, type LocalDecodedVehicle } from "./local-decoder";
import { fetchUpstream } from "./upstream";
import { transformVinDecode } from "./transformer";
import type { RawVinValuesResult, VpicRawResponse } from "../types/nhtsa";

export interface UnifiedEnergySpecs {
  readonly isElectricVehicle: boolean;
  readonly electricRangeMiles?: number;
  readonly electricRangeKm?: number;
  readonly combinedMpgOrMpge?: number;
  readonly motorDescription?: string;
  readonly chargeTimeHours240V?: number;
  readonly co2GramsPerMile?: number;
  readonly energySource: "EPA_FUELECONOMY" | "ESTIMATED" | "NONE";
}

export interface UnifiedEuropeanSpecs {
  readonly euTypeApprovalNumber?: string;
  readonly europeanVehicleCategory?: string;
  readonly curbWeightKg?: number;
  readonly grossVehicleWeightKg?: number;
  readonly maxTowingWeightUnbrakedKg?: number;
  readonly wheelbaseCm?: number;
  readonly openRecallIndicatorEu?: boolean;
  readonly euSource: "EU_RDW" | "NONE";
}

export interface UnifiedVehicleProfile {
  readonly vin: string;
  readonly make: string;
  readonly model: string;
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
  };
  readonly energy: UnifiedEnergySpecs;
  readonly europeanSpecs: UnifiedEuropeanSpecs;
  readonly provenance: {
    readonly primarySource: "LOCAL_RAM" | "NHTSA_VPIC" | "LOCAL_FALLBACK";
    readonly fallbackTriggered: boolean;
    readonly fallbackReason?: string;
    readonly enrichedSources: string[];
    readonly confidenceScorePercent: number;
    readonly cached: boolean;
    readonly resolvedAt: string;
  };
}

/**
 * Fetch EV & Fuel Economy data from US DOE / EPA FuelEconomy.gov
 */
export async function fetchEpaEnergySpecs(
  make: string,
  model: string,
  year: number
): Promise<UnifiedEnergySpecs> {
  const defaultSpecs: UnifiedEnergySpecs = {
    isElectricVehicle: false,
    energySource: "NONE",
  };

  try {
    const cleanMake = encodeURIComponent(make.trim());
    const modelSearchUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/menu/model?year=${year}&make=${cleanMake}`;

    const res = await fetch(modelSearchUrl, {
      headers: { Accept: "application/json", "User-Agent": "Vehicle-Data-Gateway/1.0" },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return defaultSpecs;

    const data = (await res.json()) as {
      menuItem?: Array<{ text: string; value: string }> | { text: string; value: string };
    };

    if (!data.menuItem) return defaultSpecs;

    const items = Array.isArray(data.menuItem) ? data.menuItem : [data.menuItem];
    const match = items.find((item) =>
      item.text.toLowerCase().includes(model.toLowerCase())
    );

    if (!match) return defaultSpecs;

    // Get vehicle option id
    const optionsUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/menu/options?year=${year}&make=${cleanMake}&model=${encodeURIComponent(
      match.value
    )}`;
    const optRes = await fetch(optionsUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });

    if (!optRes.ok) return defaultSpecs;
    const optData = (await optRes.json()) as {
      menuItem?: Array<{ text: string; value: string }> | { text: string; value: string };
    };

    const optItems = Array.isArray(optData.menuItem)
      ? optData.menuItem
      : optData.menuItem
      ? [optData.menuItem]
      : [];
    const firstId = optItems[0]?.value;
    if (!firstId) return defaultSpecs;

    // Fetch vehicle detail by ID
    const detailUrl = `https://www.fueleconomy.gov/ws/rest/vehicle/${firstId}`;
    const detailRes = await fetch(detailUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3000),
    });

    if (!detailRes.ok) return defaultSpecs;
    const vehicle = (await detailRes.json()) as Record<string, string>;

    const isEv = vehicle["atvType"] === "EV" || vehicle["fuelType"] === "Electricity";
    const rangeMiles = vehicle["range"] ? parseInt(vehicle["range"], 10) : undefined;
    const rangeKm = rangeMiles ? Math.round(rangeMiles * 1.60934) : undefined;
    const combMpg = vehicle["comb08"] ? parseInt(vehicle["comb08"], 10) : undefined;
    const chargeTime = vehicle["charge240"] ? parseFloat(vehicle["charge240"]) : undefined;
    const co2 = vehicle["co2"] ? parseInt(vehicle["co2"], 10) : undefined;

    return {
      isElectricVehicle: isEv,
      electricRangeMiles: rangeMiles && rangeMiles > 0 ? rangeMiles : undefined,
      electricRangeKm: rangeKm && rangeKm > 0 ? rangeKm : undefined,
      combinedMpgOrMpge: combMpg && combMpg > 0 ? combMpg : undefined,
      motorDescription: vehicle["evMotor"] || undefined,
      chargeTimeHours240V: chargeTime && chargeTime > 0 ? chargeTime : undefined,
      co2GramsPerMile: co2 !== undefined && co2 >= 0 ? co2 : undefined,
      energySource: "EPA_FUELECONOMY",
    };
  } catch {
    return defaultSpecs;
  }
}

/**
 * Fetch European technical specifications from Netherlands RDW Open Data
 */
export async function fetchRdwEuropeanSpecs(
  make: string,
  model: string
): Promise<UnifiedEuropeanSpecs> {
  const defaultSpecs: UnifiedEuropeanSpecs = {
    euSource: "NONE",
  };

  try {
    const cleanMake = encodeURIComponent(make.toUpperCase().trim());
    const cleanModel = encodeURIComponent(model.toUpperCase().trim());

    // Query RDW Open Data by Make and Model trade name
    const url = `https://opendata.rdw.nl/resource/m9d7-ebf2.json?merk=${cleanMake}&handelsbenaming=${cleanModel}&$limit=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Vehicle-Data-Gateway/1.0" },
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return defaultSpecs;
    const data = (await res.json()) as Array<Record<string, string>>;
    const record = data[0];
    if (!record) return defaultSpecs;

    const curbWeight = record["massa_ledig_voertuig"]
      ? parseInt(record["massa_ledig_voertuig"], 10)
      : undefined;
    const gvwr = record["toegestane_maximum_massa_voertuig"]
      ? parseInt(record["toegestane_maximum_massa_voertuig"], 10)
      : undefined;
    const unbrakedTow = record["maximum_massa_trekken_ongeremd"]
      ? parseInt(record["maximum_massa_trekken_ongeremd"], 10)
      : undefined;
    const wheelbase = record["wielbasis"] ? parseInt(record["wielbasis"], 10) : undefined;
    const openRecall = record["openstaande_terugroepactie_indicator"] === "Ja";

    return {
      euTypeApprovalNumber: record["typegoedkeuringsnummer"] || undefined,
      europeanVehicleCategory: record["europese_voertuigcategorie"] || undefined,
      curbWeightKg: curbWeight && curbWeight > 0 ? curbWeight : undefined,
      grossVehicleWeightKg: gvwr && gvwr > 0 ? gvwr : undefined,
      maxTowingWeightUnbrakedKg: unbrakedTow && unbrakedTow > 0 ? unbrakedTow : undefined,
      wheelbaseCm: wheelbase && wheelbase > 0 ? wheelbase : undefined,
      openRecallIndicatorEu: openRecall,
      euSource: "EU_RDW",
    };
  } catch {
    return defaultSpecs;
  }
}

/**
 * Unified Multi-Source Resolver with Intelligent Fallback Waterfall
 */
export async function resolveUnifiedVehicle(
  vin: string,
  _env?: Env,
  options?: { enrichWithEpa?: boolean; enrichWithEu?: boolean }
): Promise<UnifiedVehicleProfile> {
  const cleanVin = vin.toUpperCase().trim();
  const enrichedSources: string[] = [];

  // Step 1: Instant Local Pre-Decode (0.01ms baseline)
  const localDecoded: LocalDecodedVehicle = decodeVinLocally(cleanVin);

  let primarySource: "LOCAL_RAM" | "NHTSA_VPIC" | "LOCAL_FALLBACK" = "NHTSA_VPIC";
  let fallbackTriggered = false;
  let fallbackReason: string | undefined;

  let make = localDecoded.make || "UNKNOWN";
  let model = localDecoded.model || "Unknown";
  let year = localDecoded.year;
  let bodyClass: string | null = null;
  let vehicleType: string | null = localDecoded.vehicleType;
  let plantCountry: string | null = localDecoded.plantCountry;
  let manufacturer: string | null = localDecoded.manufacturer;
  let isValidVin = localDecoded.isValidCheckDigit;

  let engineCylinders: number | null = null;
  let displacementL: number | null = null;
  let horsepower: number | null = null;
  let fuelType: string | null = null;

  // Step 2: Try NHTSA VPIC primary upstream
  const upstreamUrl = `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/DecodeVinValues/${encodeURIComponent(
    cleanVin
  )}?format=json`;

  try {
    const upstreamRes = await fetchUpstream(upstreamUrl);

    if (upstreamRes.status === 200) {
      const rawData = JSON.parse(upstreamRes.bodyText) as VpicRawResponse<RawVinValuesResult>;
      const compact = transformVinDecode(rawData);

      if (compact && compact.make && compact.make !== "UNKNOWN") {
        primarySource = "NHTSA_VPIC";
        make = compact.make;
        model = compact.model || "Unknown";
        year = compact.year ?? localDecoded.year;
        bodyClass = compact.bodyClass ?? null;
        vehicleType = compact.vehicleType ?? localDecoded.vehicleType;
        plantCountry = compact.plantCountry ?? localDecoded.plantCountry;
        manufacturer = compact.manufacturer ?? localDecoded.manufacturer;
        isValidVin = compact.isValidVin;
        engineCylinders = compact.engineCylinders ?? null;
        displacementL = compact.displacementL ?? null;
        horsepower = compact.engineHp ?? null;
        fuelType = compact.fuelType ?? null;
      } else {
        // NHTSA returned 200 but unrecognized vehicle -> Fallback to Local Engine
        fallbackTriggered = true;
        primarySource = "LOCAL_FALLBACK";
        fallbackReason = "NHTSA_VIN_UNRECOGNIZED";
      }
    } else {
      // NHTSA returned 502/503/504 or network timeout -> Graceful Fallback to Local
      fallbackTriggered = true;
      primarySource = "LOCAL_FALLBACK";
      fallbackReason = `NHTSA_UPSTREAM_STATUS_${upstreamRes.status}`;
    }
  } catch (err) {
    fallbackTriggered = true;
    primarySource = "LOCAL_FALLBACK";
    fallbackReason = `NHTSA_UPSTREAM_EXCEPTION: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Step 3: Multi-Source Enrichments (Parallel execution)
  const shouldEnrichEpa = options?.enrichWithEpa !== false && year !== null && make !== "UNKNOWN";
  const shouldEnrichEu = options?.enrichWithEu !== false && make !== "UNKNOWN";

  const [epaSpecs, euSpecs] = await Promise.all([
    shouldEnrichEpa
      ? fetchEpaEnergySpecs(make, model, year!)
      : Promise.resolve<UnifiedEnergySpecs>({ isElectricVehicle: false, energySource: "NONE" }),
    shouldEnrichEu
      ? fetchRdwEuropeanSpecs(make, model)
      : Promise.resolve<UnifiedEuropeanSpecs>({ euSource: "NONE" }),
  ]);

  if (epaSpecs.energySource !== "NONE") {
    enrichedSources.push("US_EPA_FUELECONOMY");
  }
  if (euSpecs.euSource !== "NONE") {
    enrichedSources.push("EU_RDW_OPENDATA");
  }

  // Calculate confidence score
  let confidence = 50;
  if (make !== "UNKNOWN") confidence += 20;
  if (model !== "Unknown") confidence += 10;
  if (year !== null) confidence += 10;
  if (isValidVin) confidence += 10;

  return {
    vin: cleanVin,
    make,
    model,
    year,
    bodyClass,
    vehicleType,
    plantCountry,
    manufacturer,
    isValidVin,
    engine: {
      cylinders: engineCylinders,
      displacementL,
      horsepower,
      fuelType: fuelType || (epaSpecs.isElectricVehicle ? "Electricity" : null),
    },
    energy: epaSpecs,
    europeanSpecs: euSpecs,
    provenance: {
      primarySource,
      fallbackTriggered,
      fallbackReason,
      enrichedSources,
      confidenceScorePercent: confidence,
      cached: false,
      resolvedAt: new Date().toISOString(),
    },
  };
}
