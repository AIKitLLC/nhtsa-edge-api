import { Hono } from "hono";
import type { Env } from "../../types/env";
import { CONFIG } from "../../config";
import { buildCacheKey, canonicalQuery, getFromCache, getSafeExecutionContext, saveToCache } from "../../services/cache";
import { cacheControlHeader } from "../../services/cached-upstream";
import { isCacheable, resolveUnifiedVehicle } from "../../services/multi-source-resolver";
import { jsonError } from "../../services/responses";
import { decodeVin } from "../../vpic/decode";
import { toV1Spec } from "../../vpic/v1-format";
import { getVpicStore } from "../../vpic/worker-store";
import { parseModelYear, parseVin } from "../../validation/vin";

export const unifiedRouter = new Hono<{ Bindings: Env }>();

const JSON_TYPE = "application/json; charset=utf-8";
/** EPA / RDW reference data changes slowly; a week keeps the third-party load low. */
const TTL_SECONDS = CONFIG.CACHE.CATALOG_TTL_SECONDS;

/**
 * GET /api/v1/vin/:vin/unified[?modelyear=YYYY][&epa=false][&eu=false]
 * Offline vPIC decode + US EPA FuelEconomy.gov + EU RDW reference data.
 */
unifiedRouter.get("/vin/:vin/unified", async (c) => {
  const parsed = parseVin(c.req.param("vin"));
  if (!parsed.ok) return jsonError(c, 400, "INVALID_VIN_FORMAT", parsed.message);

  const year = parseModelYear(c.req.query("modelyear"));
  if (!year.ok) return jsonError(c, 400, "INVALID_MODEL_YEAR", year.message);

  const result = await decodeVin(getVpicStore(c.env.ASSETS), parsed.vin, { modelYear: year.value });
  const params = new URL(c.req.url).searchParams;
  // The data version is part of the key, so a weekly data update is never masked by the cache
  const cacheKey = buildCacheKey(
    c.req.url,
    ["v1", "unified", result.dumpVersion, parsed.vin, String(year.value ?? "")],
    canonicalQuery(params, ["epa", "eu"])
  );

  const cached = await getFromCache(cacheKey, c.env);
  if (cached) {
    return new Response(cached.bodyText, {
      status: 200,
      headers: {
        "Content-Type": JSON_TYPE,
        "Cache-Control": cacheControlHeader(TTL_SECONDS),
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
        [CONFIG.HEADERS.DATA_VERSION]: result.dumpVersion,
      },
    });
  }

  const profile = await resolveUnifiedVehicle(toV1Spec(result), result.dumpVersion, {
    enrichWithEpa: c.req.query("epa") !== "false",
    enrichWithEu: c.req.query("eu") !== "false",
  });
  const payload = {
    success: true,
    data: profile,
    _meta: {
      poweredBy: "AI Kit LLC",
      repository: "https://github.com/AIKitLLC/nhtsa-edge-api",
      docs: "https://github.com/AIKitLLC/nhtsa-edge-api#readme",
    },
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);

  const cacheable = isCacheable(profile);
  if (cacheable) {
    await saveToCache(cacheKey, body, TTL_SECONDS, JSON_TYPE, c.env, getSafeExecutionContext(c));
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": JSON_TYPE,
      // A transient enrichment failure must not be kept by clients or the CDN
      "Cache-Control": cacheable ? cacheControlHeader(TTL_SECONDS) : "no-store",
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.DATA_VERSION]: result.dumpVersion,
      [CONFIG.HEADERS.DECODE_SOURCE]: "LOCAL_VPIC",
    },
  });
});
