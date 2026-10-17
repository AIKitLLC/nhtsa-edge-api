import { Hono } from "hono";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { buildCacheKey, canonicalQuery } from "../services/cache";
import { serveCachedUpstream } from "../services/cached-upstream";
import { jsonError } from "../services/responses";
import { allowRecallsPath, encodeUpstreamPath, queryValuesOk } from "../validation/upstream-path";

export const recallsProxyRouter = new Hono<{ Bindings: Env }>();

/**
 * Query parameters accepted by the NHTSA recalls API.
 * Anything else is dropped from both the cache key and the upstream call.
 */
const RECALLS_QUERY_PARAMS = ["make", "model", "modelYear", "campaignNumber", "vin"] as const;

/**
 * Proxy for the allowlisted NHTSA Recalls API paths (https://api.nhtsa.gov/recalls/*).
 * The upstream path is case-sensitive, so the canonical spelling is the published one.
 */
recallsProxyRouter.get("/recalls/*", async (c) => {
  const url = new URL(c.req.url);
  const allowed = allowRecallsPath(url.pathname);
  if (!allowed.ok) return jsonError(c, 400, "INVALID_UPSTREAM_PATH", allowed.message);

  const query = canonicalQuery(url.searchParams, RECALLS_QUERY_PARAMS);
  if (!queryValuesOk(query)) {
    return jsonError(c, 400, "INVALID_QUERY", "A query value is too long or contains a control character.");
  }
  const search = query.toString();

  return serveCachedUpstream(c, {
    cacheKey: buildCacheKey(c.req.url, ["recalls", allowed.canonicalPath], query),
    upstreamUrl: `${CONFIG.UPSTREAM.RECALLS_BASE_URL}${encodeUpstreamPath(allowed.canonicalPath)}${search ? `?${search}` : ""}`,
    ttlSeconds: CONFIG.CACHE.RECALLS_TTL_SECONDS,
  });
});
