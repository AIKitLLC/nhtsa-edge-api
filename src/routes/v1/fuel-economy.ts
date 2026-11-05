import { Hono } from "hono";
import type { Env } from "../../types/env";
import { getEpaShard } from "../../epa/store";
import { jsonError } from "../../services/responses";
import { parseModelYear } from "../../validation/vin";

export const fuelEconomyRouter = new Hono<{ Bindings: Env }>();

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";

/**
 * GET /api/v1/fuel-economy?year=2022&make=Honda[&model=Accord]
 * EPA/DOE FuelEconomy.gov vehicle records for a model year and make. `model` keeps the records
 * whose model name contains it (case-insensitive), e.g. "Accord" also finds "Accord Hybrid".
 */
fuelEconomyRouter.get("/fuel-economy", async (c) => {
  const year = parseModelYear(c.req.query("year"));
  const make = c.req.query("make")?.trim();
  if (!year.ok || year.value === null || !make || make.length > 40) {
    return jsonError(c, 400, "INVALID_QUERY", "Query parameters 'year' (4 digits) and 'make' are required (e.g. ?year=2022&make=Honda)");
  }
  const model = c.req.query("model")?.trim().toLowerCase();
  if (model !== undefined && model.length > 80) return jsonError(c, 400, "INVALID_QUERY", "'model' is too long");

  const shard = await getEpaShard(c.env.ASSETS, year.value, make);
  // A shard holds one make (matched ignoring case and punctuation), so only the model is filtered
  const wanted = (shard?.vehicles ?? []).filter((v) => !model || String(v["model"] ?? "").toLowerCase().includes(model));
  if (!shard || wanted.length === 0) {
    return jsonError(c, 404, "NOT_FOUND", `No EPA vehicles for ${year.value} ${make}${model ? ` ${model}` : ""}`);
  }

  c.header("Cache-Control", CACHE_CONTROL);
  return c.json({
    success: true,
    count: wanted.length,
    data: wanted,
    source: "LOCAL_EPA",
    dataVersion: `epa-${shard.sourceDate}`,
    timestamp: new Date().toISOString(),
  });
});
