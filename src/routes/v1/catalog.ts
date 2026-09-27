import { Hono } from "hono";
import type { Env } from "../../types/env";
import { CONFIG } from "../../config";
import { buildCacheKey } from "../../services/cache";
import { serveCachedUpstream } from "../../services/cached-upstream";
import { getLocalMakes, getLocalModelsForMake } from "../../services/local-decoder";
import { getModelsFromD1 } from "../../services/d1-database";
import { jsonError } from "../../services/responses";

export const catalogRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/makes[?remote=true]
 * All registered makes from the bundled NHTSA catalog; `remote=true` proxies VPIC.
 */
catalogRouter.get("/makes", async (c) => {
  if (c.req.query("remote") !== "true") {
    const localMakes = getLocalMakes();
    if (localMakes.length > 0) {
      return c.json({
        success: true,
        count: localMakes.length,
        data: localMakes,
        source: "LOCAL_NHTSA_CATALOG",
        timestamp: new Date().toISOString(),
      });
    }
  }

  return serveCachedUpstream(c, {
    cacheKey: buildCacheKey(c.req.url, ["v1", "makes", "remote"]),
    upstreamUrl: `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/GetAllMakes?format=json`,
    ttlSeconds: CONFIG.CACHE.CATALOG_TTL_SECONDS,
  });
});

/**
 * GET /api/v1/models?make=:make[&remote=true]
 * Lookup order: bundled catalog -> D1 (filled by the live API sync) -> VPIC.
 */
catalogRouter.get("/models", async (c) => {
  const make = c.req.query("make")?.trim().toUpperCase();
  if (!make) {
    return jsonError(c, 400, "MISSING_MAKE", "Query parameter 'make' is required (e.g. ?make=toyota)");
  }

  if (c.req.query("remote") !== "true") {
    const localModels = getLocalModelsForMake(make);
    if (localModels && localModels.length > 0) {
      return c.json({
        success: true,
        data: { make, count: localModels.length, models: localModels },
        source: "LOCAL_NHTSA_CATALOG",
        cached: false,
        timestamp: new Date().toISOString(),
      });
    }

    if (c.env?.DB) {
      const d1Models = await getModelsFromD1(c.env.DB, make);
      if (d1Models.length > 0) {
        return c.json({
          success: true,
          data: { make, count: d1Models.length, models: d1Models },
          source: "LOCAL_D1_DATABASE",
          cached: false,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  return serveCachedUpstream(c, {
    cacheKey: buildCacheKey(c.req.url, ["v1", "models", make]),
    upstreamUrl: `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`,
    ttlSeconds: CONFIG.CACHE.CATALOG_TTL_SECONDS,
  });
});
