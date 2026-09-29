import { Hono } from "hono";
import type { Env } from "../types/env";
import type { StatsAsset } from "../vpic/types";
import { getVpicStore } from "../vpic/worker-store";
import { renderLanding } from "./landing";

export const healthRouter = new Hono<{ Bindings: Env }>();

/** Restrictive policy for the landing page: one inline style and script (by nonce), same-origin API calls. */
function landingSecurityHeaders(nonce: string): Record<string, string> {
  return {
    "Content-Security-Policy": [
      "default-src 'none'",
      `style-src 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
      "connect-src 'self'",
      "img-src data:",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
}

healthRouter.get("/", async (c) => {
  const cf = (c.req.raw as Request & { cf?: { colo?: string; country?: string } }).cf;
  const colo = cf?.colo ?? "DEV/LOCAL";
  const country = cf?.country ?? "UNKNOWN";

  // The decoder is only healthy when its data assets are readable
  let dataVersion: string | null = null;
  let stats: StatsAsset | null = null;
  let status: "healthy" | "degraded" = "healthy";
  try {
    const store = getVpicStore(c.env.ASSETS);
    dataVersion = (await store.getCore()).dumpVersion;
    stats = await store.getStats();
  } catch {
    status = "degraded";
  }
  const httpStatus = status === "healthy" ? 200 : 503;

  // The same URL answers HTML or JSON depending on Accept
  c.header("Vary", "Accept");

  // Browsers get the landing page; API clients and monitors get JSON
  if ((c.req.header("Accept") ?? "").includes("text/html") && !c.req.query("format")) {
    const nonce = btoa(crypto.randomUUID());
    for (const [name, value] of Object.entries(landingSecurityHeaders(nonce))) c.header(name, value);
    c.header("Cache-Control", status === "healthy" ? "public, max-age=120" : "no-store");
    return c.html(renderLanding({ colo, country, dataVersion, healthy: status === "healthy", stats, nonce }), httpStatus);
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
