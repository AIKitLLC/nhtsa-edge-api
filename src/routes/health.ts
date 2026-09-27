import { Hono } from "hono";
import type { Env } from "../types/env";

export const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get("/", (c) => {
  const cf = (c.req.raw as Request & { cf?: { colo?: string; country?: string } }).cf;
  const colo = cf?.colo ?? "DEV/LOCAL";
  const country = cf?.country ?? "UNKNOWN";

  return c.json({
    name: "NHTSA Edge API & High-Performance Cache",
    status: "healthy",
    version: "1.0.0",
    edge: {
      location: colo,
      country,
      kvCacheEnabled: c.env?.ENABLE_KV_CACHE === "true",
      runtime: "Cloudflare Workers",
    },
    documentation: {
      v1Endpoints: {
        vinDecode: "GET /api/v1/vin/:vin",
        makes: "GET /api/v1/makes",
        models: "GET /api/v1/models?make=:make",
        recalls: "GET /api/v1/recalls/:vin",
      },
      dropInVPICProxy: {
        description: "100% drop-in replacement for vpic.nhtsa.dot.gov/api/vehicles",
        sample: "GET /vehicles/DecodeVinValues/:vin?format=json",
        compactMode: "Add &clean=true to strip ~100 empty fields and save 80% bandwidth",
      },
      dropInRecallsProxy: {
        description: "Drop-in proxy for api.nhtsa.gov/recalls",
        sample: "GET /recalls/recallsByVin?vin=:vin",
      },
    },
    timestamp: new Date().toISOString(),
  });
});
