/**
 * Clean v1 JSON shape of an offline decode: typed headline fields plus every
 * decoded attribute keyed by its vPIC variable code.
 */

import type { DecodeResult } from "./decode";
import { toDecodeVinValues } from "./format";

/** spvindecodemultiple's definition of a clean decode (by ErrorCode list). */
const CLEAN_ERROR_CODES = new Set(["0", "0,10", "1,10", "1,400", "1,10,400"]);

export interface V1VehicleSpec {
  readonly vin: string;
  readonly make: string | null;
  readonly makeId: number | null;
  readonly model: string | null;
  readonly modelId: number | null;
  readonly modelYear: number | null;
  readonly trim: string | null;
  readonly series: string | null;
  readonly manufacturer: string | null;
  readonly manufacturerId: number | null;
  readonly vehicleType: string | null;
  readonly bodyClass: string | null;
  readonly doors: number | null;
  readonly driveType: string | null;
  readonly engineCylinders: number | null;
  readonly displacementL: number | null;
  readonly engineHp: number | null;
  readonly fuelType: string | null;
  readonly electrificationLevel: string | null;
  readonly plantCountry: string | null;
  readonly plantState: string | null;
  readonly plantCity: string | null;
  readonly errorCodes: readonly number[];
  readonly errorText: string | null;
  readonly isCleanDecode: boolean;
  readonly suggestedVin: string | null;
  /** Every non-empty decoded value, keyed by vPIC variable code. */
  readonly attributes: Readonly<Record<string, string>>;
}

const text = (v: string | undefined): string | null => (v === undefined || v.trim() === "" ? null : v.trim());

function int(v: string | undefined): number | null {
  const t = text(v);
  if (t === null || !/^-?\d+$/.test(t)) return null;
  return Number(t);
}

function decimal(v: string | undefined): number | null {
  const t = text(v);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function toV1Spec(result: DecodeResult): V1VehicleSpec {
  const values = toDecodeVinValues(result, result.vin);
  const attributes = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => key !== "VIN" && value.trim() !== "")
  );
  const errorCode = values["ErrorCode"] ?? "";

  return {
    vin: result.vin,
    make: text(values["Make"]),
    makeId: int(values["MakeID"]),
    model: text(values["Model"]),
    modelId: int(values["ModelID"]),
    modelYear: int(values["ModelYear"]),
    trim: text(values["Trim"]),
    series: text(values["Series"]),
    manufacturer: text(values["Manufacturer"]),
    manufacturerId: int(values["ManufacturerId"]),
    vehicleType: text(values["VehicleType"]),
    bodyClass: text(values["BodyClass"]),
    doors: int(values["Doors"]),
    driveType: text(values["DriveType"]),
    engineCylinders: int(values["EngineCylinders"]),
    displacementL: decimal(values["DisplacementL"]),
    engineHp: decimal(values["EngineHP"]),
    fuelType: text(values["FuelTypePrimary"]),
    electrificationLevel: text(values["ElectrificationLevel"]),
    plantCountry: text(values["PlantCountry"]),
    plantState: text(values["PlantState"]),
    plantCity: text(values["PlantCity"]),
    errorCodes: errorCode
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c !== "")
      .map(Number),
    errorText: text(values["ErrorText"]),
    isCleanDecode: CLEAN_ERROR_CODES.has(errorCode.trim()),
    suggestedVin: text(values["SuggestedVIN"]),
    attributes,
  };
}
