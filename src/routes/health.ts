import { Hono } from "hono";
import type { Env } from "../types/env";
import { getVpicStore } from "../vpic/worker-store";

export const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get("/", async (c) => {
  const cf = (c.req.raw as Request & { cf?: { colo?: string; country?: string } }).cf;

  // The decoder is only healthy when its data assets are readable
  let dataVersion: string | null = null;
  let status: "healthy" | "degraded" = "healthy";
  try {
    dataVersion = (await getVpicStore(c.env.ASSETS).getCore()).dumpVersion;
  } catch {
    status = "degraded";
  }

  return c.json(
    {
      name: "NHTSA Edge API",
      status,
      environment: c.env.ENVIRONMENT ?? "unknown",
      dataVersion,
      edge: {
        location: cf?.colo ?? "DEV/LOCAL",
        country: cf?.country ?? "UNKNOWN",
      },
      endpoints: {
        vinDecode: "GET /api/v1/vin/:vin[?modelyear=YYYY]",
        vinParityCheck: "GET /api/v1/vin/:vin/compare",
        makes: "GET /api/v1/makes",
        models: "GET /api/v1/models?make=:make",
        recalls: "GET /api/v1/recalls/:vin",
        vpicDecodeVinValues: "GET /vehicles/DecodeVinValues/:vin?format=json[&modelyear=YYYY]",
        vpicDecodeVin: "GET /vehicles/DecodeVin/:vin?format=json",
        vpicBatch: "POST /vehicles/DecodeVINValuesBatch/ (format=json, data=VIN[,year];...)",
        vpicOther: "GET /vehicles/* (proxied to vpic.nhtsa.dot.gov, cached)",
        recallsProxy: "GET /recalls/* (proxied to api.nhtsa.gov, cached)",
      },
      timestamp: new Date().toISOString(),
    },
    status === "healthy" ? 200 : 503
  );
});
