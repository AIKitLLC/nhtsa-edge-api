import { Hono } from "hono";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { buildCacheKey, canonicalQuery } from "../services/cache";
import { serveCachedUpstream } from "../services/cached-upstream";

export const recallsProxyRouter = new Hono<{ Bindings: Env }>();

/**
 * Query parameters accepted by the NHTSA recalls API.
 * Anything else is dropped from both the cache key and the upstream call.
 */
const RECALLS_QUERY_PARAMS = ["make", "model", "modelYear", "campaignNumber", "vin"] as const;

/**
 * Proxy for NHTSA Recalls API (https://api.nhtsa.gov/recalls/*)
 */
recallsProxyRouter.get("/recalls/*", async (c) => {
  const url = new URL(c.req.url);
  const query = canonicalQuery(url.searchParams, RECALLS_QUERY_PARAMS);
  const search = query.toString();

  return serveCachedUpstream(c, {
    cacheKey: buildCacheKey(c.req.url, ["recalls", url.pathname.toLowerCase()], query),
    upstreamUrl: `${CONFIG.UPSTREAM.RECALLS_BASE_URL}${url.pathname}${search ? `?${search}` : ""}`,
    ttlSeconds: CONFIG.CACHE.RECALLS_TTL_SECONDS,
  });
});
