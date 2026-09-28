import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { getFromCache, getSafeExecutionContext, normalizeCacheKey, saveToCache } from "../services/cache";
import { fetchUpstream } from "../services/upstream";
import { transformVinDecode } from "../services/transformer";
import {
  decodeVinLocally,
  getLocalMakes,
  getLocalModelsForMake,
} from "../services/local-decoder";
import { compareWithUpstream } from "../services/comparator";
import {
  getVinFromD1,
  saveVinToD1,
  getWmiFromD1,
  logParityAudit,
  seedInitialD1Data,
} from "../services/d1-database";
import type { RawVinValuesResult, VpicRawResponse } from "../types/nhtsa";
import { resolveUnifiedVehicle } from "../services/multi-source-resolver";

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
    // Graceful Fallback: Fall back to local 49 CFR Part 565 engine if NHTSA is down
    const local = decodeVinLocally(vin);
    if (local.make && local.make !== "UNKNOWN") {
      const fallbackSpec = {
        vin,
        make: local.make,
        model: local.model || "Unknown",
        year: local.year,
        trim: null,
        vehicleType: local.vehicleType,
        bodyClass: null,
        doors: null,
        driveType: null,
        engineCylinders: null,
        displacementL: null,
        engineHp: null,
        fuelType: null,
        plantCountry: local.plantCountry,
        plantCity: null,
        manufacturer: local.manufacturer,
        isValidVin: local.isValidCheckDigit,
        errorCode: "FALLBACK_LOCAL_ENGINE",
        errorText: `NHTSA upstream status ${upstreamRes.status}; decoded via local 49 CFR Part 565 engine`,
        extraAttributes: {},
      };

      return c.json({
        success: true,
        data: fallbackSpec,
        source: "LOCAL_FALLBACK",
        cached: false,
        timestamp: new Date().toISOString(),
      });
    }

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

  // 4. Save to Cache and D1 Database
  if (c.env?.DB) {
    const execCtx = getSafeExecutionContext(c);
    const saveTask = saveVinToD1(c.env.DB, compactSpec);
    if (execCtx) {
      execCtx.waitUntil(saveTask);
    } else {
      await saveTask;
    }
  }

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
 * GET /api/v1/vin/:vin/local
 * 100% Local Engine VIN Decoder (Zero upstream calls, sub-millisecond execution).
 * Executes 49 CFR Part 565 check digit, model year, and WMI algorithms natively.
 */
v1Router.get("/vin/:vin/local", async (c) => {
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
  const startTime = performance.now();

  // 1. Check Cloudflare D1 local database if bound
  if (c.env?.DB) {
    const d1Record = await getVinFromD1(c.env.DB, vin);
    if (d1Record) {
      const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
      return c.json({
        success: true,
        data: d1Record,
        source: "LOCAL_D1_DATABASE",
        latencyMs,
      });
    }
  }

  // 2. Execute local NHTSA standard decoder
  let localResult = decodeVinLocally(vin);

  // 3. Enrich with D1 WMI catalog if needed
  if (c.env?.DB && (!localResult.make || !localResult.manufacturer)) {
    const wmiRecord = await getWmiFromD1(c.env.DB, localResult.wmi);
    if (wmiRecord) {
      localResult = {
        ...localResult,
        make: wmiRecord.make,
        manufacturer: wmiRecord.manufacturer,
        vehicleType: wmiRecord.vehicle_type ?? localResult.vehicleType,
        decodeSource: "LOCAL_D1_DATABASE",
      };
    }
  }

  const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;

  return c.json({
    success: true,
    data: localResult,
    source: localResult.decodeSource,
    latencyMs,
  });
});

/**
 * GET /api/v1/vin/:vin/unified
 * Multi-Source Unified Vehicle Decoder with Intelligent Fallback Waterfall:
 * - Tier 1: Local RAM Engine (0.01ms - 49 CFR Part 565 + 13,001 WMIs)
 * - Tier 2: Edge Cache API
 * - Tier 3: Primary NHTSA VPIC Upstream
 * - Tier 4: Fallback to Local Engine if NHTSA is down or unrecognized
 * - Tier 5: Enrichment with US EPA FuelEconomy (EV Range, MPGe, Motor kW)
 *           and EU RDW Open Data (EU Type Approval, Curb Weight, GVWR, Axles)
 */
v1Router.get("/vin/:vin/unified", async (c) => {
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

  // Check Edge Cache
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

  const profile = await resolveUnifiedVehicle(vin, c.env, {
    enrichWithEpa: c.req.query("epa") !== "false",
    enrichWithEu: c.req.query("eu") !== "false",
  });

  const responsePayload = {
    success: true,
    data: profile,
    cached: false,
    timestamp: new Date().toISOString(),
  };

  const responseBody = JSON.stringify(responsePayload);
  await saveToCache(
    cacheKey,
    JSON.stringify({ ...responsePayload, cached: true }),
    CONFIG.CACHE.VIN_TTL_SECONDS,
    "application/json; charset=utf-8",
    c.env,
    getSafeExecutionContext(c)
  );

  return new Response(responseBody, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": `public, max-age=${CONFIG.CACHE.VIN_TTL_SECONDS}, s-maxage=${CONFIG.CACHE.VIN_TTL_SECONDS}, stale-while-revalidate=${CONFIG.CACHE.SWR_TTL_SECONDS}`,
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: profile.provenance.primarySource,
    },
  });
});

/**
 * GET /api/v1/vin/:vin/compare
 * Parity and Accuracy Verification Engine:
 * Concurrently calls Local Engine and Upstream NHTSA VPIC,
 * calculates accuracy parity score (0-100%), and detects any discrepancies.
 */
v1Router.get("/vin/:vin/compare", async (c) => {
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

  // 1. Run Local Engine
  const localStart = performance.now();
  let localResult = decodeVinLocally(vin);
  if (c.env?.DB && (!localResult.make || !localResult.manufacturer)) {
    const wmiRecord = await getWmiFromD1(c.env.DB, localResult.wmi);
    if (wmiRecord) {
      localResult = {
        ...localResult,
        make: wmiRecord.make,
        manufacturer: wmiRecord.manufacturer,
        vehicleType: wmiRecord.vehicle_type ?? localResult.vehicleType,
        decodeSource: "LOCAL_D1_DATABASE",
      };
    }
  }
  const localLatencyMs = Math.round((performance.now() - localStart) * 100) / 100;

  // 2. Fetch Upstream NHTSA VPIC
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
          message: `NHTSA upstream returned status ${upstreamRes.status}`,
        },
        localResult,
      },
      502
    );
  }

  let rawData: VpicRawResponse<RawVinValuesResult>;
  try {
    rawData = JSON.parse(upstreamRes.bodyText) as VpicRawResponse<RawVinValuesResult>;
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_UPSTREAM_PAYLOAD",
          message: "Unable to parse upstream JSON",
        },
      },
      502
    );
  }

  const upstreamSpec = transformVinDecode(rawData);
  if (!upstreamSpec) {
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

  // 3. Compare Local vs Upstream
  const comparison = compareWithUpstream(
    localResult,
    upstreamSpec,
    localLatencyMs,
    upstreamRes.latencyMs
  );

  // 4. Self-healing: persist upstream spec to D1 and log audit asynchronously
  if (c.env?.DB) {
    const execCtx = getSafeExecutionContext(c);
    const saveTask = Promise.all([
      saveVinToD1(c.env.DB, upstreamSpec),
      logParityAudit(c.env.DB, comparison),
    ]);
    if (execCtx) {
      execCtx.waitUntil(saveTask);
    } else {
      await saveTask;
    }
  }

  return c.json({
    success: true,
    data: comparison,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/v1/admin/seed
 * Seeds initial top manufacturer WMI data into Cloudflare D1
 */
v1Router.post("/admin/seed", async (c) => {
  if (!c.env?.DB) {
    return c.json(
      {
        success: false,
        error: {
          code: "D1_NOT_BOUND",
          message: "Cloudflare D1 database binding 'DB' is not configured.",
        },
      },
      400
    );
  }

  const inserted = await seedInitialD1Data(c.env.DB);
  return c.json({
    success: true,
    message: `Successfully seeded ${inserted} WMI entries into Cloudflare D1.`,
  });
});

/**
 * GET /api/v1/makes
 * Cached list of all registered vehicle makes
 */
/**
 * GET /api/v1/makes
 * Cached list of all registered vehicle makes from local NHTSA catalog
 */
v1Router.get("/makes", async (c) => {
  const isRemoteRequested = c.req.query("remote") === "true";

  // 1. Return from local 100% NHTSA dataset if remote not forced
  if (!isRemoteRequested) {
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
 * Cached list of models for a specified make from local NHTSA catalog (32,009 models)
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

  const isRemoteRequested = c.req.query("remote") === "true";

  // 1. Check local NHTSA models catalog first (<0.05ms)
  if (!isRemoteRequested) {
    const localModels = getLocalModelsForMake(make);
    if (localModels && localModels.length > 0) {
      return c.json({
        success: true,
        data: {
          make: make.toUpperCase(),
          count: localModels.length,
          models: localModels,
        },
        source: "LOCAL_NHTSA_CATALOG",
        cached: false,
        timestamp: new Date().toISOString(),
      });
    }
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
