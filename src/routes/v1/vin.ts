import { Hono } from "hono";
import type { Env } from "../../types/env";
import { CONFIG } from "../../config";
import { fetchUpstream, upstreamTimeoutMs } from "../../services/upstream";
import { jsonError } from "../../services/responses";
import { decodeVin } from "../../vpic/decode";
import { toDecodeVinValues } from "../../vpic/format";
import { toV1Spec } from "../../vpic/v1-format";
import { getVpicStore } from "../../vpic/worker-store";
import { parseModelYear, parseVin } from "../../validation/vin";

export const vinRouter = new Hono<{ Bindings: Env }>();

/** Decodes are deterministic for a given data version; let clients and the CDN keep them. */
const DECODE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

/**
 * GET /api/v1/vin/:vin[?modelyear=YYYY]
 * Full offline decode (port of vPIC spVinDecode over the bundled NHTSA dataset).
 */
vinRouter.get("/vin/:vin", async (c) => {
  const parsed = parseVin(c.req.param("vin"));
  if (!parsed.ok) return jsonError(c, 400, "INVALID_VIN_FORMAT", parsed.message);

  const year = parseModelYear(c.req.query("modelyear"));
  if (!year.ok) return jsonError(c, 400, "INVALID_MODEL_YEAR", year.message);

  const started = performance.now();
  const result = await decodeVin(getVpicStore(c.env.ASSETS), parsed.vin, { modelYear: year.value });
  const decodeMs = Math.round((performance.now() - started) * 100) / 100;

  c.header("Cache-Control", DECODE_CACHE_CONTROL);
  c.header(CONFIG.HEADERS.DATA_VERSION, result.dumpVersion);
  return c.json({
    success: true,
    data: toV1Spec(result),
    source: "LOCAL_VPIC",
    dataVersion: result.dumpVersion,
    decodeMs,
    _meta: {
      poweredBy: "AI Kit LLC",
      repository: "https://github.com/AIKitLLC/nhtsa-edge-api",
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/vin/:vin/compare[?modelyear=YYYY]
 * Field-by-field comparison of the offline decode with the live vPIC API (never cached).
 */
vinRouter.get("/vin/:vin/compare", async (c) => {
  const parsed = parseVin(c.req.param("vin"));
  if (!parsed.ok) return jsonError(c, 400, "INVALID_VIN_FORMAT", parsed.message);

  const year = parseModelYear(c.req.query("modelyear"));
  if (!year.ok) return jsonError(c, 400, "INVALID_MODEL_YEAR", year.message);

  const result = await decodeVin(getVpicStore(c.env.ASSETS), parsed.vin, { modelYear: year.value });
  const local = toDecodeVinValues(result, parsed.vin);

  const query = new URLSearchParams({ format: "json" });
  if (year.value !== null) query.set("modelyear", String(year.value));
  const upstream = await fetchUpstream(
    `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/DecodeVinValues/${encodeURIComponent(parsed.vin)}?${query.toString()}`,
    { timeoutMs: upstreamTimeoutMs(c.env) }
  );
  if (upstream.status !== 200) {
    return jsonError(c, 502, "UPSTREAM_ERROR", `NHTSA vPIC returned status ${upstream.status}`);
  }

  let live: Record<string, string>;
  try {
    const body = JSON.parse(upstream.bodyText) as { Results?: Record<string, string>[] };
    live = body.Results?.[0] ?? {};
  } catch {
    return jsonError(c, 502, "INVALID_UPSTREAM_PAYLOAD", "Unable to parse the NHTSA vPIC response");
  }

  const differences = [...new Set([...Object.keys(local), ...Object.keys(live)])]
    .filter((key) => (local[key] ?? "").trim() !== (live[key] ?? "").trim())
    .sort()
    .map((field) => ({ field, local: local[field] ?? null, live: live[field] ?? null }));

  c.header("Cache-Control", "no-store");
  return c.json({
    success: true,
    data: {
      vin: parsed.vin,
      identical: differences.length === 0,
      differences,
      dataVersion: result.dumpVersion,
      upstreamMs: upstream.latencyMs,
    },
    timestamp: new Date().toISOString(),
  });
});
