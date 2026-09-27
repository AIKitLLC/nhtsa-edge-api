import { Hono } from "hono";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { getFromCache, getSafeExecutionContext, normalizeCacheKey, saveToCache } from "../services/cache";
import { fetchUpstream } from "../services/upstream";

export const recallsProxyRouter = new Hono<{ Bindings: Env }>();

/**
 * Proxy for NHTSA Recalls API (https://api.nhtsa.gov/recalls/*)
 */
recallsProxyRouter.all("/recalls/*", async (c) => {
  const url = new URL(c.req.url);
  const normalizedKey = normalizeCacheKey(url.toString());
  const ttlSeconds = CONFIG.CACHE.RECALLS_TTL_SECONDS;

  // 1. Check Cache
  const cached = await getFromCache(normalizedKey, c.env);
  if (cached) {
    return new Response(cached.bodyText, {
      status: cached.status,
      headers: {
        ...Object.fromEntries(cached.headers.entries()),
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
      },
    });
  }

  // 2. Build Upstream URL
  const upstreamUrl = new URL(`${CONFIG.UPSTREAM.RECALLS_BASE_URL}${url.pathname}`);
  for (const [key, val] of url.searchParams.entries()) {
    upstreamUrl.searchParams.set(key, val);
  }

  // 3. Fetch from Upstream
  const upstreamRes = await fetchUpstream(upstreamUrl.toString());

  // 4. Save to Cache if status is 200
  if (upstreamRes.status === 200) {
    await saveToCache(
      normalizedKey,
      upstreamRes.bodyText,
      ttlSeconds,
      "application/json; charset=utf-8",
      c.env,
      getSafeExecutionContext(c)
    );
  }

  // 5. Return Response
  return new Response(upstreamRes.bodyText, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${CONFIG.CACHE.SWR_TTL_SECONDS}`,
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: "UPSTREAM",
      [CONFIG.HEADERS.UPSTREAM_TIME]: `${upstreamRes.latencyMs}`,
    },
  });
});
