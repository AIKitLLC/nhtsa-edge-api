import { Hono, type Context } from "hono";
import type { Env } from "../../types/env";
import type { CompactVehicleSpec } from "../../types/nhtsa";
import { CONFIG } from "../../config";
import { buildCacheKey, getSafeExecutionContext } from "../../services/cache";
import { serveCachedUpstream } from "../../services/cached-upstream";
import { fetchUpstream, upstreamTimeoutMs } from "../../services/upstream";
import { specFromUpstream, vinDecodeUrl } from "../../services/vin-upstream";
import { decodeWithEnrichment } from "../../services/local-enrichment";
import { compareWithUpstream } from "../../services/comparator";
import { logParityAudit, saveVinToD1 } from "../../services/d1-database";
import { jsonError } from "../../services/responses";
import { parseVin } from "../../validation/vin";

export const vinRouter = new Hono<{ Bindings: Env }>();

/**
 * Runs a background task after the response when an ExecutionContext exists,
 * otherwise (tests, local scripts) awaits it inline.
 */
async function runInBackground(c: Context<{ Bindings: Env }>, task: Promise<unknown>): Promise<void> {
  const execCtx = getSafeExecutionContext(c);
  if (execCtx) {
    execCtx.waitUntil(task);
  } else {
    await task;
  }
}

function roundMs(ms: number): number {
  return Math.round(ms * 100) / 100;
}

/**
 * GET /api/v1/vin/:vin
 * Compact VIN decode backed by NHTSA VPIC, cached for 30 days.
 */
vinRouter.get("/vin/:vin", async (c) => {
  const parsed = parseVin(c.req.param("vin"));
  if (!parsed.ok) {
    return jsonError(c, 400, "INVALID_VIN_FORMAT", parsed.message);
  }
  const vin = parsed.vin;

  // Holder object: TS does not track assignments made inside the transform callback
  const decoded: { spec: CompactVehicleSpec | null } = { spec: null };

  const response = await serveCachedUpstream(c, {
    cacheKey: buildCacheKey(c.req.url, ["v1", "vin", vin]),
    upstreamUrl: vinDecodeUrl(vin),
    ttlSeconds: CONFIG.CACHE.VIN_TTL_SECONDS,
    transform: (upstream) => {
      const result = specFromUpstream(upstream, vin);
      if (!result.ok) {
        return {
          status: result.status,
          body: JSON.stringify({
            success: false,
            error: { code: result.code, message: result.message },
            timestamp: new Date().toISOString(),
          }),
        };
      }

      decoded.spec = result.spec;
      const payload = {
        success: true,
        data: result.spec,
        source: "UPSTREAM",
        cached: false,
        timestamp: new Date().toISOString(),
      };
      return {
        status: 200,
        body: JSON.stringify(payload),
        cacheBody: JSON.stringify({ ...payload, source: "EDGE_CACHE", cached: true }),
      };
    },
  });

  if (decoded.spec && c.env?.DB) {
    await runInBackground(c, saveVinToD1(c.env.DB, decoded.spec));
  }

  return response;
});

/**
 * GET /api/v1/vin/:vin/local
 * In-memory 49 CFR Part 565 decode (check digit, model year, WMI), no upstream call.
 * Enriched from D1 when bound. Always returns the LocalDecodedVehicle shape.
 */
vinRouter.get("/vin/:vin/local", async (c) => {
  const parsed = parseVin(c.req.param("vin"));
  if (!parsed.ok) {
    return jsonError(c, 400, "INVALID_VIN_FORMAT", parsed.message);
  }

  const startTime = performance.now();
  const result = await decodeWithEnrichment(parsed.vin, c.env);

  return c.json({
    success: true,
    data: result,
    source: result.decodeSource,
    latencyMs: roundMs(performance.now() - startTime),
  });
});

/**
 * GET /api/v1/vin/:vin/compare
 * Parity audit: local engine vs live NHTSA VPIC (never cached).
 */
vinRouter.get("/vin/:vin/compare", async (c) => {
  const parsed = parseVin(c.req.param("vin"));
  if (!parsed.ok) {
    return jsonError(c, 400, "INVALID_VIN_FORMAT", parsed.message);
  }
  const vin = parsed.vin;

  const localStart = performance.now();
  const localResult = await decodeWithEnrichment(vin, c.env, { useStoredVin: false });
  const localLatencyMs = roundMs(performance.now() - localStart);

  const upstream = await fetchUpstream(vinDecodeUrl(vin), { timeoutMs: upstreamTimeoutMs(c.env) });
  const result = specFromUpstream(upstream, vin);
  if (!result.ok) {
    return jsonError(c, result.status, result.code, result.message, { localResult });
  }

  const comparison = compareWithUpstream(localResult, result.spec, localLatencyMs, upstream.latencyMs);

  if (c.env?.DB) {
    await runInBackground(
      c,
      Promise.all([saveVinToD1(c.env.DB, result.spec), logParityAudit(c.env.DB, comparison)])
    );
  }

  return c.json({
    success: true,
    data: comparison,
    timestamp: new Date().toISOString(),
  });
});
