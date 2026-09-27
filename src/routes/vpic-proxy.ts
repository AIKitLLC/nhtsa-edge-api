import { Hono } from "hono";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { buildCacheKey, canonicalQuery } from "../services/cache";
import { serveCachedUpstream } from "../services/cached-upstream";
import { cleanEmptyFields } from "../services/transformer";
import type { VpicRawResponse } from "../types/nhtsa";
import { matchOfflineDecode, serveOfflineBatch, serveOfflineDecode } from "./vpic-decode";

export const vpicProxyRouter = new Hono<{ Bindings: Env }>();

/**
 * Query parameters accepted by the public VPIC GET endpoints.
 * Anything else is dropped from both the cache key and the upstream call.
 */
const VPIC_QUERY_PARAMS = [
  "format",
  "modelyear",
  "year",
  "make",
  "model",
  "units",
  "page",
  "vehicleType",
  "manufacturer",
] as const;

function ttlForPath(lowerPath: string): number {
  if (lowerPath.includes("decodevin")) {
    return CONFIG.CACHE.VIN_TTL_SECONDS;
  }
  if (
    lowerPath.includes("getallmakes") ||
    lowerPath.includes("getmodelsformake") ||
    lowerPath.includes("getvehiclevariablelist")
  ) {
    return CONFIG.CACHE.CATALOG_TTL_SECONDS;
  }
  return CONFIG.CACHE.DEFAULT_TTL_SECONDS;
}

function cleanVpicBody(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as VpicRawResponse<Record<string, unknown>>;
    if (!Array.isArray(parsed.Results)) return bodyText;
    return JSON.stringify({
      ...parsed,
      Results: parsed.Results.map((item) => cleanEmptyFields(item)),
    });
  } catch {
    // Non-JSON payload (e.g. format=xml) - serve untouched
    return bodyText;
  }
}

/**
 * POST /vehicles/DecodeVINValuesBatch/ is answered by the offline decoder.
 */
vpicProxyRouter.post("/vehicles/*", async (c) => {
  const lowerPath = new URL(c.req.url).pathname.replace(/^\/api\//, "/").toLowerCase();
  if (/^\/vehicles\/decodevinvaluesbatch\/?$/.test(lowerPath)) {
    return serveOfflineBatch(c);
  }
  return c.json({ success: false, error: { code: "METHOD_NOT_ALLOWED", message: "Only GET is supported here" } }, 405);
});

/**
 * Drop-in VPIC API. Matches both /vehicles/* and /api/vehicles/*
 * (the router is mounted at "/" and "/api"). DecodeVinValues and DecodeVin are
 * answered by the offline decoder; every other endpoint is proxied and cached.
 */
vpicProxyRouter.get("/vehicles/*", async (c) => {
  const url = new URL(c.req.url);
  // Strip optional '/api' prefix; VPIC paths are case-insensitive
  const subPath = url.pathname.replace(/^\/api\//, "/");
  const lowerPath = subPath.toLowerCase();

  const offline = matchOfflineDecode(subPath);
  if (offline) {
    const response = await serveOfflineDecode(c, offline, url.searchParams);
    if (response) return response;
  }

  const query = canonicalQuery(url.searchParams, VPIC_QUERY_PARAMS);
  if (!query.has("format")) {
    query.set("format", "json");
    query.sort();
  }

  const isCleanRequested =
    url.searchParams.get("clean") === "true" || url.searchParams.get("compact") === "true";

  const upstreamUrl = `${CONFIG.UPSTREAM.VPIC_BASE_URL}${subPath}?${query.toString()}`;
  const cacheKey = buildCacheKey(
    c.req.url,
    ["vpic", lowerPath, isCleanRequested ? "clean" : "raw"],
    query
  );

  return serveCachedUpstream(c, {
    cacheKey,
    upstreamUrl,
    ttlSeconds: ttlForPath(lowerPath),
    transform: (upstream) => ({
      status: upstream.status,
      body:
        isCleanRequested && upstream.status === 200
          ? cleanVpicBody(upstream.bodyText)
          : upstream.bodyText,
    }),
  });
});
