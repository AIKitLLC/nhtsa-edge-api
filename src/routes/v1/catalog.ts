import { Hono } from "hono";
import type { Env } from "../../types/env";
import { CONFIG } from "../../config";
import { jsonError } from "../../services/responses";
import { getVpicStore } from "../../vpic/worker-store";

export const catalogRouter = new Hono<{ Bindings: Env }>();

const CATALOG_CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

/**
 * GET /api/v1/makes
 * Every make in the bundled vPIC dataset (vpic.Make).
 */
catalogRouter.get("/makes", async (c) => {
  const store = getVpicStore(c.env.ASSETS);
  const [core, makes] = await Promise.all([store.getCore(), store.getMakes()]);

  c.header("Cache-Control", CATALOG_CACHE_CONTROL);
  c.header(CONFIG.HEADERS.DATA_VERSION, core.dumpVersion);
  return c.json({
    success: true,
    count: makes.length,
    data: makes,
    source: "LOCAL_VPIC",
    dataVersion: core.dumpVersion,
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/v1/models?make=:make
 * Models of a make (vpic.Make_Model), matched on the make name case-insensitively.
 */
catalogRouter.get("/models", async (c) => {
  const make = c.req.query("make")?.trim();
  if (!make) {
    return jsonError(c, 400, "MISSING_MAKE", "Query parameter 'make' is required (e.g. ?make=toyota)");
  }

  const store = getVpicStore(c.env.ASSETS);
  const [core, matches] = await Promise.all([store.getCore(), store.getModelsForMake(make)]);
  if (matches.length === 0) {
    return jsonError(c, 404, "MAKE_NOT_FOUND", `No make named '${make}' in ${core.dumpVersion}`);
  }

  c.header("Cache-Control", CATALOG_CACHE_CONTROL);
  c.header(CONFIG.HEADERS.DATA_VERSION, core.dumpVersion);
  return c.json({
    success: true,
    data: matches.map(({ make: m, models }) => ({ makeId: m.id, make: m.name, count: models.length, models })),
    source: "LOCAL_VPIC",
    dataVersion: core.dumpVersion,
    timestamp: new Date().toISOString(),
  });
});
