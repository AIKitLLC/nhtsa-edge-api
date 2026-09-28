import { Hono } from "hono";
import type { Env } from "../types/env";
import { getVpicStore } from "../vpic/worker-store";
import { renderLanding } from "./landing";

export const healthRouter = new Hono<{ Bindings: Env }>();

healthRouter.get("/", async (c) => {
  const cf = (c.req.raw as Request & { cf?: { colo?: string; country?: string } }).cf;
  const colo = cf?.colo ?? "DEV/LOCAL";
  const country = cf?.country ?? "UNKNOWN";

  // The decoder is only healthy when its data assets are readable
  let dataVersion: string | null = null;
  let status: "healthy" | "degraded" = "healthy";
  try {
    dataVersion = (await getVpicStore(c.env.ASSETS).getCore()).dumpVersion;
  } catch {
    status = "degraded";
  }
  const httpStatus = status === "healthy" ? 200 : 503;

  // Browsers get the landing page; API clients and monitors get JSON
  if ((c.req.header("Accept") ?? "").includes("text/html") && !c.req.query("format")) {
    return c.html(renderLanding({ colo, country, dataVersion, healthy: status === "healthy" }), httpStatus);
  }

  return c.json(
    {
      name: "NHTSA Edge API",
      status,
      environment: c.env.ENVIRONMENT ?? "unknown",
      dataVersion,
      project: {
        organization: "AI Kit LLC",
        repository: "https://github.com/AIKitLLC/nhtsa-edge-api",
        docs: "https://github.com/AIKitLLC/nhtsa-edge-api#readme",
        license: "MIT",
      },
      edge: { location: colo, country },
      endpoints: {
        vinDecode: "GET /api/v1/vin/:vin[?modelyear=YYYY]",
        vinUnified: "GET /api/v1/vin/:vin/unified[?epa=false&eu=false] (decode + US EPA + EU RDW)",
        vinParityCheck: "GET /api/v1/vin/:vin/compare",
        makes: "GET /api/v1/makes",
        models: "GET /api/v1/models?make=:make",
        recalls: "GET /api/v1/recalls/:vin",
        vpicDecodeVinValues: "GET /vehicles/DecodeVinValues/:vin?format=json[&modelyear=YYYY][&clean=true]",
        vpicDecodeVin: "GET /vehicles/DecodeVin/:vin?format=json[&clean=true]",
        vpicBatch: "POST /vehicles/DecodeVINValuesBatch/ (format=json, data=VIN[,year];...)",
        vpicOther: "GET /vehicles/* (proxied to vpic.nhtsa.dot.gov, cached)",
        recallsProxy: "GET /recalls/* (proxied to api.nhtsa.gov, cached)",
      },
      timestamp: new Date().toISOString(),
    },
    httpStatus
  );
});
