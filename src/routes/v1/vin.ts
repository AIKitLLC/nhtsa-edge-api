import { Hono } from "hono";
import type { Env } from "../../types/env";
import { CONFIG } from "../../config";
import { buildCacheKey, getFromCache, getSafeExecutionContext, saveToCache } from "../../services/cache";
import { cacheControlHeader } from "../../services/cached-upstream";
import { fetchUpstream, upstreamTimeoutMs } from "../../services/upstream";
import { jsonError } from "../../services/responses";
import { decodeVin } from "../../vpic/decode";
import { toDecodeVinValues } from "../../vpic/format";
import { toV1Spec } from "../../vpic/v1-format";
import { getVpicStore } from "../../vpic/worker-store";
import { FullVinSchema, parseModelYear, parseVin } from "../../validation/vin";

export const vinRouter = new Hono<{ Bindings: Env }>();

/** Decodes are deterministic for a given data version; let clients and the CDN keep them. */
const DECODE_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
/** Live vPIC moves between dumps. A day stops a refresh from calling NHTSA every time. */
const COMPARE_TTL_SECONDS = CONFIG.CACHE.DEFAULT_TTL_SECONDS;
const JSON_TYPE = "application/json; charset=utf-8";

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
 * Field-by-field comparison of the offline decode with the live vPIC API, cached for 24 hours.
 * The live call is vPIC, so it does not carry the data.gov key.
 */
vinRouter.get("/vin/:vin/compare", async (c) => {
  const parsed = parseVin(c.req.param("vin"), FullVinSchema);
  if (!parsed.ok) return jsonError(c, 400, "INVALID_VIN_FORMAT", parsed.message);

  const year = parseModelYear(c.req.query("modelyear"));
  if (!year.ok) return jsonError(c, 400, "INVALID_MODEL_YEAR", year.message);

  const result = await decodeVin(getVpicStore(c.env.ASSETS), parsed.vin, { modelYear: year.value });
  const cacheKey = buildCacheKey(c.req.url, ["v1", "compare", result.dumpVersion, parsed.vin, String(year.value ?? "")]);
  const cached = await getFromCache(cacheKey, c.env);
  if (cached) {
    return new Response(cached.bodyText, {
      status: 200,
      headers: {
        "Content-Type": JSON_TYPE,
        "Cache-Control": cacheControlHeader(COMPARE_TTL_SECONDS),
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
        [CONFIG.HEADERS.DATA_VERSION]: result.dumpVersion,
      },
    });
  }

  const local = toDecodeVinValues(result, parsed.vin);

  const query = new URLSearchParams({ format: "json" });
  if (year.value !== null) query.set("modelyear", String(year.value));
  const upstream = await fetchUpstream(
    `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/DecodeVinValues/${encodeURIComponent(parsed.vin)}?${query.toString()}`,
    { timeoutMs: upstreamTimeoutMs(c.env) }
  );
  if (upstream.status !== 200) {
    c.header("Cache-Control", "no-store");
    return jsonError(c, 502, "UPSTREAM_ERROR", `NHTSA vPIC returned status ${upstream.status}`);
  }

  let live: Record<string, string>;
  try {
    const body = JSON.parse(upstream.bodyText) as { Results?: Record<string, string>[] };
    live = body.Results?.[0] ?? {};
  } catch {
    c.header("Cache-Control", "no-store");
    return jsonError(c, 502, "INVALID_UPSTREAM_PAYLOAD", "Unable to parse the NHTSA vPIC response");
  }

  const differences = [...new Set([...Object.keys(local), ...Object.keys(live)])]
    .filter((key) => (local[key] ?? "").trim() !== (live[key] ?? "").trim())
    .sort()
    .map((field) => ({ field, local: local[field] ?? null, live: live[field] ?? null }));

  const payload = {
    success: true,
    data: {
      vin: parsed.vin,
      identical: differences.length === 0,
      differences,
      dataVersion: result.dumpVersion,
      upstreamMs: upstream.latencyMs,
    },
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);
  await saveToCache(cacheKey, body, COMPARE_TTL_SECONDS, JSON_TYPE, c.env, getSafeExecutionContext(c));
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": JSON_TYPE,
      "Cache-Control": cacheControlHeader(COMPARE_TTL_SECONDS),
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: "UPSTREAM",
      [CONFIG.HEADERS.DATA_VERSION]: result.dumpVersion,
      [CONFIG.HEADERS.UPSTREAM_TIME]: `${upstream.latencyMs}`,
    },
  });
});
