import { CONFIG } from "../config";
import type { CompactVehicleSpec, RawVinValuesResult, VpicRawResponse } from "../types/nhtsa";
import { transformVinDecode } from "./transformer";
import type { UpstreamFetchResult } from "./upstream";

export type UpstreamSpecResult =
  | { readonly ok: true; readonly spec: CompactVehicleSpec }
  | {
      readonly ok: false;
      readonly status: 404 | 502;
      readonly code: string;
      readonly message: string;
    };

export function vinDecodeUrl(vin: string): string {
  return `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`;
}

/**
 * Interprets a VPIC DecodeVinValues response as a compact vehicle spec,
 * mapping every failure mode to a client-facing status and error code.
 */
export function specFromUpstream(upstream: UpstreamFetchResult, vin: string): UpstreamSpecResult {
  if (upstream.status !== 200) {
    return {
      ok: false,
      status: 502,
      code: "UPSTREAM_ERROR",
      message: `NHTSA VPIC upstream returned status ${upstream.status}`,
    };
  }

  let raw: VpicRawResponse<RawVinValuesResult>;
  try {
    raw = JSON.parse(upstream.bodyText) as VpicRawResponse<RawVinValuesResult>;
  } catch {
    return {
      ok: false,
      status: 502,
      code: "INVALID_UPSTREAM_PAYLOAD",
      message: "Unable to parse upstream NHTSA JSON response",
    };
  }

  const spec = Array.isArray(raw.Results) ? transformVinDecode(raw) : null;
  if (!spec) {
    return {
      ok: false,
      status: 404,
      code: "NOT_FOUND",
      message: `No vehicle records found for VIN: ${vin}`,
    };
  }

  return { ok: true, spec };
}
