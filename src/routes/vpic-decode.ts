import type { Context } from "hono";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { decodeVin } from "../vpic/decode";
import { toDecodeVinValues, toDecodeVinVariables, vpicEnvelope } from "../vpic/format";
import { getVpicStore } from "../vpic/worker-store";

/** vPIC's DecodeVINValuesBatch accepts at most 50 VINs per request. */
const MAX_BATCH = 50;
const DECODE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

type DecodeKind = "values" | "variables";

/**
 * Matches the vPIC decode endpoints the offline decoder serves (paths are
 * case-insensitive in vPIC): DecodeVinValues/:vin and DecodeVin/:vin.
 * The *Extended variants include private NCSA data and stay upstream.
 */
export function matchOfflineDecode(path: string): { kind: DecodeKind; vin: string } | null {
  const match = /^\/vehicles\/(decodevinvalues|decodevin)\/([^/]+)\/?$/i.exec(path);
  if (!match || !match[1] || !match[2]) return null;
  // The VIN keeps the caller's spelling (echoed in SearchCriteria and VIN, as vPIC does)
  return { kind: match[1].toLowerCase() === "decodevinvalues" ? "values" : "variables", vin: decodeURIComponent(match[2]) };
}

function parseModelYear(raw: string | null): number | null {
  return raw !== null && /^\d{4}$/.test(raw.trim()) ? Number(raw.trim()) : null;
}

function offlineHeaders(dataVersion: string): Record<string, string> {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": DECODE_CACHE_CONTROL,
    [CONFIG.HEADERS.DECODE_SOURCE]: "LOCAL_VPIC",
    [CONFIG.HEADERS.DATA_VERSION]: dataVersion,
  };
}

/**
 * GET /vehicles/DecodeVinValues/:vin and /vehicles/DecodeVin/:vin (format=json, optional modelyear).
 * Returns null when the request must be proxied instead (non-JSON formats, VIN > 17 chars).
 */
export async function serveOfflineDecode(
  c: Context<{ Bindings: Env }>,
  target: { kind: DecodeKind; vin: string },
  params: URLSearchParams
): Promise<Response | null> {
  const format = (params.get("format") ?? "json").toLowerCase();
  const vin = target.vin.trim().toUpperCase();
  if (format !== "json" || vin.length > 17) return null;

  const modelYear = parseModelYear(params.get("modelyear"));
  const result = await decodeVin(getVpicStore(c.env.ASSETS), vin, { modelYear });
  const criteria = `VIN(s): ${target.vin}`;
  const body =
    target.kind === "values"
      ? vpicEnvelope(criteria, [toDecodeVinValues(result, target.vin)])
      : vpicEnvelope(criteria, toDecodeVinVariables(result));

  return new Response(JSON.stringify(body), { status: 200, headers: offlineHeaders(result.dumpVersion) });
}

/**
 * POST /vehicles/DecodeVINValuesBatch/ with form fields format=json and
 * data="VIN[,modelyear];VIN[,modelyear];..." (at most 50 entries).
 */
export async function serveOfflineBatch(c: Context<{ Bindings: Env }>): Promise<Response> {
  const form = await c.req.parseBody();
  const format = String(form["format"] ?? "json").toLowerCase();
  if (format !== "json") {
    return c.json({ success: false, error: { code: "UNSUPPORTED_FORMAT", message: "Only format=json is supported" } }, 400);
  }

  const entries = String(form["data"] ?? "")
    .split(";")
    .map((e) => e.trim())
    .filter((e) => e !== "");
  if (entries.length > MAX_BATCH) {
    return c.json({ success: false, error: { code: "BATCH_TOO_LARGE", message: `At most ${MAX_BATCH} VINs per request` } }, 400);
  }

  const store = getVpicStore(c.env.ASSETS);
  const results: Record<string, string>[] = [];
  let dataVersion = "";
  for (const entry of entries) {
    const [rawVin = "", rawYear = null] = entry.split(",");
    const vin = rawVin.trim().toUpperCase();
    if (vin.length === 0 || vin.length > 17) {
      return c.json({ success: false, error: { code: "INVALID_VIN_FORMAT", message: `Invalid VIN in batch: '${rawVin}'` } }, 400);
    }
    const result = await decodeVin(store, vin, { modelYear: parseModelYear(rawYear) });
    dataVersion = result.dumpVersion;
    results.push(toDecodeVinValues(result, rawVin.trim()));
  }

  const body = vpicEnvelope("", results);
  return new Response(JSON.stringify(body), { status: 200, headers: offlineHeaders(dataVersion) });
}
