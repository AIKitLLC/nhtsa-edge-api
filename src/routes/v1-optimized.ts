import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { getFromCache, getSafeExecutionContext, normalizeCacheKey, saveToCache } from "../services/cache";
import { fetchUpstream } from "../services/upstream";
import { transformVinDecode } from "../services/transformer";
import type { RawVinValuesResult, VpicRawResponse } from "../types/nhtsa";

export const v1Router = new Hono<{ Bindings: Env }>();

const VinParamSchema = z
  .string()
  .min(3, "VIN query must be at least 3 characters")
  .max(30, "VIN query is too long")
  .regex(/^[A-Za-z0-9*_\-]+$/, "VIN must contain only alphanumeric characters or wildcards");

/**
 * GET /api/v1/vin/:vin
 * High-performance, compact VIN decoder.
 * Strips 100+ empty VPIC fields and converts types to numbers where appropriate.
 */
v1Router.get("/vin/:vin", async (c) => {
  const rawVin = c.req.param("vin").trim().toUpperCase();
  const validation = VinParamSchema.safeParse(rawVin);

  if (!validation.success) {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_VIN_FORMAT",
          message: validation.error.errors[0]?.message ?? "Invalid VIN format",
        },
      },
      400
    );
  }

  const vin = validation.data;
  const cacheKey = normalizeCacheKey(c.req.url);

  // 1. Check L1/L2 Cache
  const cached = await getFromCache(cacheKey, c.env);
  if (cached) {
    return new Response(cached.bodyText, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
      },
    });
  }

  // 2. Fetch from VPIC upstream DecodeVinValues
  const upstreamUrl = `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/DecodeVinValues/${encodeURIComponent(
    vin
  )}?format=json`;

  const upstreamRes = await fetchUpstream(upstreamUrl);
  if (upstreamRes.status !== 200) {
    return c.json(
      {
        success: false,
        error: {
          code: "UPSTREAM_ERROR",
          message: `NHTSA VPIC upstream returned status ${upstreamRes.status}`,
        },
      },
      502
    );
  }

  // 3. Transform verbose response into compact vehicle spec
  let rawData: VpicRawResponse<RawVinValuesResult>;
  try {
    rawData = JSON.parse(upstreamRes.bodyText) as VpicRawResponse<RawVinValuesResult>;
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_UPSTREAM_PAYLOAD",
          message: "Unable to parse upstream NHTSA JSON response",
        },
      },
      502
    );
  }

  const compactSpec = transformVinDecode(rawData);
  if (!compactSpec) {
    return c.json(
      {
        success: false,
        error: {
          code: "NOT_FOUND",
          message: `No vehicle records found for VIN: ${vin}`,
        },
      },
      404
    );
  }

  const responsePayload = {
    success: true,
    data: compactSpec,
    source: "UPSTREAM",
    cached: false,
    timestamp: new Date().toISOString(),
  };

  const responseBody = JSON.stringify(responsePayload);
  const ttl = CONFIG.CACHE.VIN_TTL_SECONDS;

  // 4. Save to Cache
  await saveToCache(
    cacheKey,
    JSON.stringify({ ...responsePayload, source: "EDGE_CACHE", cached: true }),
    ttl,
    "application/json; charset=utf-8",
    c.env,
    getSafeExecutionContext(c)
  );

  return new Response(responseBody, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${ttl}, s-maxage=${ttl}, stale-while-revalidate=${CONFIG.CACHE.SWR_TTL_SECONDS}`,
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: "UPSTREAM",
      [CONFIG.HEADERS.UPSTREAM_TIME]: `${upstreamRes.latencyMs}`,
    },
  });
});

/**
 * GET /api/v1/makes
 * Cached list of all registered vehicle makes
 */
v1Router.get("/makes", async (c) => {
  const cacheKey = normalizeCacheKey(c.req.url);

  const cached = await getFromCache(cacheKey, c.env);
  if (cached) {
    return new Response(cached.bodyText, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
      },
    });
  }

  const upstreamUrl = `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/GetAllMakes?format=json`;
  const upstreamRes = await fetchUpstream(upstreamUrl);

  if (upstreamRes.status === 200) {
    await saveToCache(
      cacheKey,
      upstreamRes.bodyText,
      CONFIG.CACHE.CATALOG_TTL_SECONDS,
      "application/json; charset=utf-8",
      c.env,
      getSafeExecutionContext(c)
    );
  }

  return new Response(upstreamRes.bodyText, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CONFIG.CACHE.CATALOG_TTL_SECONDS}, s-maxage=${CONFIG.CACHE.CATALOG_TTL_SECONDS}, stale-while-revalidate=${CONFIG.CACHE.SWR_TTL_SECONDS}`,
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: "UPSTREAM",
      [CONFIG.HEADERS.UPSTREAM_TIME]: `${upstreamRes.latencyMs}`,
    },
  });
});

/**
 * GET /api/v1/models?make=:make
 * Cached list of models for a specified make
 */
v1Router.get("/models", async (c) => {
  const make = c.req.query("make")?.trim();
  if (!make) {
    return c.json(
      {
        success: false,
        error: {
          code: "MISSING_MAKE",
          message: "Query parameter 'make' is required (e.g. ?make=toyota)",
        },
      },
      400
    );
  }

  const cacheKey = normalizeCacheKey(c.req.url);

  const cached = await getFromCache(cacheKey, c.env);
  if (cached) {
    return new Response(cached.bodyText, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
      },
    });
  }

  const upstreamUrl = `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/GetModelsForMake/${encodeURIComponent(
    make
  )}?format=json`;
  const upstreamRes = await fetchUpstream(upstreamUrl);

  if (upstreamRes.status === 200) {
    await saveToCache(
      cacheKey,
      upstreamRes.bodyText,
      CONFIG.CACHE.CATALOG_TTL_SECONDS,
      "application/json; charset=utf-8",
      c.env,
      getSafeExecutionContext(c)
    );
  }

  return new Response(upstreamRes.bodyText, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CONFIG.CACHE.CATALOG_TTL_SECONDS}, s-maxage=${CONFIG.CACHE.CATALOG_TTL_SECONDS}, stale-while-revalidate=${CONFIG.CACHE.SWR_TTL_SECONDS}`,
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: "UPSTREAM",
      [CONFIG.HEADERS.UPSTREAM_TIME]: `${upstreamRes.latencyMs}`,
    },
  });
});

/**
 * GET /api/v1/recalls/:vin
 * Cached recalls information for a vehicle
 */
v1Router.get("/recalls/:vin", async (c) => {
  const vin = c.req.param("vin").trim().toUpperCase();
  const cacheKey = normalizeCacheKey(c.req.url);

  const cached = await getFromCache(cacheKey, c.env);
  if (cached) {
    return new Response(cached.bodyText, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
      },
    });
  }

  const upstreamUrl = `${CONFIG.UPSTREAM.RECALLS_BASE_URL}/recalls/recallsByVin?vin=${encodeURIComponent(
    vin
  )}`;
  const upstreamRes = await fetchUpstream(upstreamUrl);

  if (upstreamRes.status === 200) {
    await saveToCache(
      cacheKey,
      upstreamRes.bodyText,
      CONFIG.CACHE.RECALLS_TTL_SECONDS,
      "application/json; charset=utf-8",
      c.env,
      getSafeExecutionContext(c)
    );
  }

  return new Response(upstreamRes.bodyText, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CONFIG.CACHE.RECALLS_TTL_SECONDS}, s-maxage=${CONFIG.CACHE.RECALLS_TTL_SECONDS}, stale-while-revalidate=${CONFIG.CACHE.SWR_TTL_SECONDS}`,
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: "UPSTREAM",
      [CONFIG.HEADERS.UPSTREAM_TIME]: `${upstreamRes.latencyMs}`,
    },
  });
});
