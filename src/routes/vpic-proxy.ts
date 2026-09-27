import { Hono } from "hono";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { getFromCache, getSafeExecutionContext, normalizeCacheKey, saveToCache } from "../services/cache";
import { fetchUpstream } from "../services/upstream";
import { cleanEmptyFields } from "../services/transformer";
import type { VpicRawResponse } from "../types/nhtsa";

export const vpicProxyRouter = new Hono<{ Bindings: Env }>();

/**
 * Fallback / Wildcard handler for VPIC vehicles API
 * Matches both /vehicles/* and /api/vehicles/*
 */
vpicProxyRouter.all("/vehicles/*", async (c) => {
  const url = new URL(c.req.url);
  const normalizedKey = normalizeCacheKey(url.toString());

  // Determine TTL based on endpoint type
  const path = url.pathname.toLowerCase();
  let ttlSeconds = CONFIG.CACHE.DEFAULT_TTL_SECONDS;

  if (path.includes("decodevin")) {
    ttlSeconds = CONFIG.CACHE.VIN_TTL_SECONDS;
  } else if (
    path.includes("getallmakes") ||
    path.includes("getmodelsformake") ||
    path.includes("getvehiclevariablelist")
  ) {
    ttlSeconds = CONFIG.CACHE.CATALOG_TTL_SECONDS;
  }

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
  // Strip optional '/api' prefix from incoming worker path
  const subPath = url.pathname.replace(/^\/api\//, "/");
  const upstreamUrl = new URL(`${CONFIG.UPSTREAM.VPIC_BASE_URL}${subPath}`);

  // Guarantee format=json if not explicitly specified
  if (!url.searchParams.has("format")) {
    upstreamUrl.searchParams.set("format", "json");
  }
  for (const [key, val] of url.searchParams.entries()) {
    if (key !== "clean" && key !== "compact") {
      upstreamUrl.searchParams.set(key, val);
    }
  }

  // 3. Fetch from Upstream NHTSA VPIC
  const upstreamRes = await fetchUpstream(upstreamUrl.toString());

  let responseBody = upstreamRes.bodyText;

  // Optional: Clean empty fields if ?clean=true or ?compact=true
  const isCleanRequested =
    url.searchParams.get("clean") === "true" ||
    url.searchParams.get("compact") === "true";

  if (isCleanRequested && upstreamRes.status === 200) {
    try {
      const parsed = JSON.parse(upstreamRes.bodyText) as VpicRawResponse<Record<string, unknown>>;
      if (Array.isArray(parsed.Results)) {
        const cleanedResults = parsed.Results.map((item) => cleanEmptyFields(item));
        responseBody = JSON.stringify({
          ...parsed,
          Results: cleanedResults,
        });
      }
    } catch {
      // If parsing fails, fall back to raw body
    }
  }

  // 4. Save to Cache if status is 200
  if (upstreamRes.status === 200) {
    await saveToCache(
      normalizedKey,
      responseBody,
      ttlSeconds,
      "application/json; charset=utf-8",
      c.env,
      getSafeExecutionContext(c)
    );
  }

  // 5. Return Response
  return new Response(responseBody, {
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
