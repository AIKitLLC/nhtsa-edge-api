import { Hono } from "hono";
import type { Env } from "../../types/env";
import { CONFIG } from "../../config";
import { buildCacheKey } from "../../services/cache";
import { serveCachedUpstream } from "../../services/cached-upstream";
import { jsonError } from "../../services/responses";
import { FullVinSchema, parseVin } from "../../validation/vin";

export const recallsRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/v1/recalls/:vin
 * Safety recall campaigns for a full 17-character VIN, cached for 6 hours.
 */
recallsRouter.get("/recalls/:vin", async (c) => {
  const parsed = parseVin(c.req.param("vin"), FullVinSchema);
  if (!parsed.ok) {
    return jsonError(c, 400, "INVALID_VIN_FORMAT", parsed.message);
  }

  return serveCachedUpstream(c, {
    cacheKey: buildCacheKey(c.req.url, ["v1", "recalls", parsed.vin]),
    upstreamUrl: `${CONFIG.UPSTREAM.RECALLS_BASE_URL}/recalls/recallsByVin?vin=${encodeURIComponent(parsed.vin)}`,
    ttlSeconds: CONFIG.CACHE.RECALLS_TTL_SECONDS,
  });
});
