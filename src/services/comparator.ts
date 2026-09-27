import type { LocalDecodedVehicle } from "./local-decoder";
import type { CompactVehicleSpec } from "../types/nhtsa";

export type AuditFieldStatus =
  | "MATCH"
  | "MISMATCH"
  | "LOCAL_MISSING"
  | "UPSTREAM_MISSING";

export interface FieldAuditItem {
  readonly field: string;
  readonly localValue: unknown;
  readonly upstreamValue: unknown;
  readonly status: AuditFieldStatus;
  readonly match: boolean;
}

export interface ParityComparisonReport {
  readonly vin: string;
  readonly isExactMatch: boolean;
  readonly parityScorePercent: number;
  readonly latencyComparison: {
    readonly localEngineMs: number;
    readonly upstreamNhtsaMs: number;
    readonly speedupMultiplier: number;
  };
  readonly fieldAudits: readonly FieldAuditItem[];
  readonly localResult: LocalDecodedVehicle;
  readonly upstreamResult: CompactVehicleSpec;
}

/**
 * Normalizes string comparison (case-insensitive, trims)
 */
function isStringMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

/**
 * Compares Local Engine output with NHTSA VPIC Upstream output to audit accuracy
 */
export function compareWithUpstream(
  local: LocalDecodedVehicle,
  upstream: CompactVehicleSpec,
  localLatencyMs: number,
  upstreamLatencyMs: number
): ParityComparisonReport {
  const audits: FieldAuditItem[] = [];

  // 1. Audit Check Digit / Error Code
  const checkDigitMatch =
    local.nhtsaErrorCode === upstream.errorCode ||
    (local.isValidCheckDigit && upstream.errorCode === "0") ||
    (!local.isValidCheckDigit && upstream.errorCode !== "0");

  audits.push({
    field: "errorCode",
    localValue: local.nhtsaErrorCode,
    upstreamValue: upstream.errorCode,
    status: checkDigitMatch ? "MATCH" : "MISMATCH",
    match: checkDigitMatch,
  });

  // 2. Audit Make
  const makeMatch = isStringMatch(local.make, upstream.make);
  audits.push({
    field: "make",
    localValue: local.make,
    upstreamValue: upstream.make,
    status:
      local.make && upstream.make
        ? makeMatch
          ? "MATCH"
          : "MISMATCH"
        : !local.make
        ? "LOCAL_MISSING"
        : "UPSTREAM_MISSING",
    match: makeMatch,
  });

  // 3. Audit Model Year
  const yearMatch = local.year === upstream.year;
  audits.push({
    field: "year",
    localValue: local.year,
    upstreamValue: upstream.year,
    status:
      local.year !== null && upstream.year !== null
        ? yearMatch
          ? "MATCH"
          : "MISMATCH"
        : !local.year
        ? "LOCAL_MISSING"
        : "UPSTREAM_MISSING",
    match: yearMatch,
  });

  // 4. Audit Plant Country
  const countryMatch =
    isStringMatch(local.plantCountry, upstream.plantCountry) ||
    (local.plantCountry?.includes("UNITED STATES") &&
      upstream.plantCountry?.toUpperCase().includes("UNITED STATES"));

  audits.push({
    field: "plantCountry",
    localValue: local.plantCountry,
    upstreamValue: upstream.plantCountry,
    status:
      local.plantCountry && upstream.plantCountry
        ? countryMatch
          ? "MATCH"
          : "MISMATCH"
        : !local.plantCountry
        ? "LOCAL_MISSING"
        : "UPSTREAM_MISSING",
    match: Boolean(countryMatch),
  });

  // 5. Audit Vehicle Type (if available locally)
  if (local.vehicleType || upstream.vehicleType) {
    const typeMatch = isStringMatch(local.vehicleType, upstream.vehicleType);
    audits.push({
      field: "vehicleType",
      localValue: local.vehicleType,
      upstreamValue: upstream.vehicleType,
      status:
        local.vehicleType && upstream.vehicleType
          ? typeMatch
            ? "MATCH"
            : "MISMATCH"
          : !local.vehicleType
          ? "LOCAL_MISSING"
          : "UPSTREAM_MISSING",
      match: typeMatch,
    });
  }

  // Calculate Parity Score Percentage
  const matchCount = audits.filter((a) => a.match).length;
  const parityScorePercent = Math.round((matchCount / audits.length) * 100);
  const isExactMatch = parityScorePercent === 100;

  const safeLocalLat = Math.max(0.1, localLatencyMs);
  const speedupMultiplier = Math.round((upstreamLatencyMs / safeLocalLat) * 10) / 10;

  return {
    vin: local.vin,
    isExactMatch,
    parityScorePercent,
    latencyComparison: {
      localEngineMs: localLatencyMs,
      upstreamNhtsaMs: upstreamLatencyMs,
      speedupMultiplier,
    },
    fieldAudits: audits,
    localResult: local,
    upstreamResult: upstream,
  };
}
