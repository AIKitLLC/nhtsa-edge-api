import type {
  CompactVehicleSpec,
  RawVinValuesResult,
  VpicRawResponse,
  VpicVariableItem,
} from "../types/nhtsa";

/**
 * Strips empty strings, nulls, undefined, and "Not Applicable" entries from an object.
 */
export function cleanEmptyFields<T extends Record<string, unknown>>(
  record: T
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed.toLowerCase() === "not applicable") {
        continue;
      }
      result[key] = trimmed;
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Safely parses an integer or returns null
 */
export function parseSafeInt(val: string | null | undefined): number | null {
  if (!val) return null;
  const parsed = parseInt(val.trim(), 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Safely parses a float or returns null
 */
export function parseSafeFloat(val: string | null | undefined): number | null {
  if (!val) return null;
  const parsed = parseFloat(val.trim());
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Core transformer converting verbose VPIC DecodeVinValues results into a compact,
 * high-performance JSON vehicle specification.
 */
export function transformVinDecode(
  rawVpic: VpicRawResponse<RawVinValuesResult>
): CompactVehicleSpec | null {
  const first = rawVpic.Results[0];
  if (!first) {
    return null;
  }

  const primaryKeys = new Set([
    "VIN",
    "Make",
    "Model",
    "ModelYear",
    "Trim",
    "Series",
    "VehicleType",
    "BodyClass",
    "Doors",
    "DriveType",
    "EngineCylinders",
    "DisplacementL",
    "EngineHP",
    "FuelTypePrimary",
    "ElectrificationLevel",
    "PlantCountry",
    "PlantCity",
    "Manufacturer",
    "ErrorCode",
    "ErrorText",
  ]);

  const extraAttributes: Record<string, string> = {};

  for (const [key, rawVal] of Object.entries(first)) {
    if (primaryKeys.has(key)) continue;
    if (typeof rawVal === "string") {
      const trimmed = rawVal.trim();
      if (trimmed !== "" && trimmed.toLowerCase() !== "not applicable") {
        extraAttributes[key] = trimmed;
      }
    }
  }

  const errorCode = first.ErrorCode ? first.ErrorCode.trim() : null;
  // ErrorCode "0" in VPIC means success: "0 - VIN decoded clean"
  const isValidVin = errorCode === "0";

  return {
    vin: (first.VIN ?? "").trim(),
    make: first.Make?.trim() || null,
    model: first.Model?.trim() || null,
    year: parseSafeInt(first.ModelYear),
    trim: first.Trim?.trim() || null,
    series: first.Series?.trim() || null,
    vehicleType: first.VehicleType?.trim() || null,
    bodyClass: first.BodyClass?.trim() || null,
    doors: parseSafeInt(first.Doors),
    driveType: first.DriveType?.trim() || null,
    engineCylinders: parseSafeInt(first.EngineCylinders),
    displacementL: parseSafeFloat(first.DisplacementL),
    engineHp: parseSafeInt(first.EngineHP),
    fuelType: first.FuelTypePrimary?.trim() || null,
    electrificationLevel: first.ElectrificationLevel?.trim() || null,
    plantCountry: first.PlantCountry?.trim() || null,
    plantCity: first.PlantCity?.trim() || null,
    manufacturer: first.Manufacturer?.trim() || null,
    isValidVin,
    errorCode,
    errorText: first.ErrorText?.trim() || null,
    extraAttributes,
  };
}

/**
 * Transforms DecodeVin variable-array style response into a lean key-value map.
 */
export function transformVariableArray(
  rawVpic: VpicRawResponse<VpicVariableItem>
): Record<string, string> {
  const map: Record<string, string> = {};

  for (const item of rawVpic.Results) {
    if (item.Value && typeof item.Value === "string") {
      const trimmed = item.Value.trim();
      if (trimmed !== "" && trimmed.toLowerCase() !== "not applicable") {
        map[item.Variable] = trimmed;
      }
    }
  }

  return map;
}
