import { Hono } from "hono";
import type { Env } from "../types/env";
import {
  syncMakesFromApi,
  syncModelsForMakeFromApi,
  syncWmiFromApi,
  runIncrementalSync,
} from "../services/api-syncer";

export const syncRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/sync/makes
 * Syncs list of all vehicle makes directly from NHTSA API into Cloudflare D1
 */
syncRouter.post("/makes", async (c) => {
  const result = await syncMakesFromApi(c.env);
  return c.json(result, result.success ? 200 : 502);
});

/**
 * POST /api/v1/sync/models?make=:make
 * Syncs models for a specific make directly from NHTSA API
 */
syncRouter.post("/models", async (c) => {
  const make = c.req.query("make")?.trim();
  if (!make) {
    return c.json(
      {
        success: false,
        error: "Query parameter 'make' is required (e.g. ?make=toyota)",
      },
      400
    );
  }

  const result = await syncModelsForMakeFromApi(make, c.env);
  return c.json(result, result.success ? 200 : 502);
});

/**
 * POST /api/v1/sync/wmi?wmi=:wmi
 * Syncs a specific WMI directly from NHTSA API into D1
 */
syncRouter.post("/wmi", async (c) => {
  const wmi = c.req.query("wmi")?.trim();
  if (!wmi) {
    return c.json({ success: false, error: "Query parameter 'wmi' is required" }, 400);
  }

  const result = await syncWmiFromApi(wmi, c.env);
  if (!result) {
    return c.json(
      {
        success: false,
        error: `Could not fetch WMI '${wmi}' from NHTSA API`,
      },
      404
    );
  }

  return c.json({
    success: true,
    data: result,
    source: "LIVE_API_SYNC",
  });
});

/**
 * POST /api/v1/sync/incremental
 * Triggers incremental sync for top automotive manufacturers
 */
syncRouter.post("/incremental", async (c) => {
  const result = await runIncrementalSync(c.env);
  return c.json({
    success: true,
    data: result,
    message: `Incremental sync complete: ${result.totalModelsSynced} models refreshed across ${result.totalMakesProcessed} makes.`,
  });
});

/**
 * GET /api/v1/sync/status
 * Retrieves sync history and status from Cloudflare D1
 */
syncRouter.get("/status", async (c) => {
  if (!c.env?.DB) {
    return c.json({
      status: "operational",
      d1DatabaseBound: false,
      message: "D1 database is not bound. In-memory master catalog is active.",
    });
  }

  try {
    const history = await c.env.DB
      .prepare(
        "SELECT id, sync_channel, sync_type, records_processed, records_updated, status, details, synced_at FROM sync_history ORDER BY synced_at DESC LIMIT 20"
      )
      .all();

    const wmiCount = await c.env.DB
      .prepare("SELECT COUNT(*) as count FROM wmi_catalog")
      .first<{ count: number }>();

    const modelsCount = await c.env.DB
      .prepare("SELECT COUNT(*) as count FROM makes_models")
      .first<{ count: number }>();

    return c.json({
      status: "operational",
      d1DatabaseBound: true,
      stats: {
        totalWmisInD1: wmiCount?.count ?? 0,
        totalModelsInD1: modelsCount?.count ?? 0,
      },
      recentSyncs: history.results,
    });
  } catch (err: unknown) {
    return c.json({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
  }
});
