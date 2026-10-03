import { Hono } from "hono";
import type { Context } from "hono";
import type { Env } from "../types/env";
import type { StatsAsset } from "../vpic/types";
import { getVpicStore } from "../vpic/worker-store";
import { renderDocsPage, renderHub, renderVpicPage, type PageInfo } from "./landing";

export const healthRouter = new Hono<{ Bindings: Env }>();

type AppContext = Context<{ Bindings: Env }>;

/** Restrictive policy for the website: one inline style and script (by nonce), same-origin API calls. */
function pageSecurityHeaders(nonce: string): Record<string, string> {
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

interface Snapshot {
  readonly colo: string;
  readonly country: string;
  readonly dataVersion: string | null;
  readonly stats: StatsAsset | null;
  readonly status: "healthy" | "degraded";
}

/** Edge location plus the data version; "degraded" when the data assets are unreadable. */
async function snapshot(c: AppContext): Promise<Snapshot> {
  const cf = (c.req.raw as Request & { cf?: { colo?: string; country?: string } }).cf;
  const base = { colo: cf?.colo ?? "DEV/LOCAL", country: cf?.country ?? "UNKNOWN" };
  try {
    const store = getVpicStore(c.env.ASSETS);
    const dataVersion = (await store.getCore()).dumpVersion;
    return { ...base, dataVersion, stats: await store.getStats(), status: "healthy" };
  } catch {
    return { ...base, dataVersion: null, stats: null, status: "degraded" };
  }
}

function htmlPage(c: AppContext, snap: Snapshot, render: (info: PageInfo) => string): Response {
  const nonce = btoa(crypto.randomUUID());
  const healthy = snap.status === "healthy";
  for (const [name, value] of Object.entries(pageSecurityHeaders(nonce))) c.header(name, value);
  c.header("Cache-Control", healthy ? "public, max-age=120" : "no-store");
  const html = render({ colo: snap.colo, country: snap.country, dataVersion: snap.dataVersion, healthy, stats: snap.stats, nonce });
  return c.html(html, healthy ? 200 : 503);
}

function healthJson(c: AppContext, snap: Snapshot): Response {
  return c.json(
    {
      name: "AI Kit Data",
      status: snap.status,
      environment: c.env.ENVIRONMENT ?? "unknown",
      dataVersion: snap.dataVersion,
      project: {
        organization: "AI Kit LLC",
        repository: "https://github.com/AIKitLLC/nhtsa-edge-api",
        docs: "https://github.com/AIKitLLC/nhtsa-edge-api#readme",
        license: "MIT",
      },
      edge: { location: snap.colo, country: snap.country },
      datasets: {
        vpic: "live (offline VIN decoding)",
        recalls: "partial (proxied to NHTSA, cached)",
        fuelEconomy: "partial (model-level data in /api/v1/vin/:vin/unified)",
        complaintsAndNcap: "planned",
      },
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
    snap.status === "healthy" ? 200 : 503
  );
}

// "/" is the hub for browsers and the JSON health document for API clients and monitors.
healthRouter.get("/", async (c) => {
  const snap = await snapshot(c);
  // The same URL answers HTML or JSON depending on Accept
  c.header("Vary", "Accept");
  if ((c.req.header("Accept") ?? "").includes("text/html") && !c.req.query("format")) {
    return htmlPage(c, snap, renderHub);
  }
  return healthJson(c, snap);
});

// Always JSON, for monitors that send a browser-like Accept header.
healthRouter.get("/health", async (c) => healthJson(c, await snapshot(c)));

// The VIN decoder page.
healthRouter.get("/vpic", async (c) => htmlPage(c, await snapshot(c), renderVpicPage));

// The API reference, rendered from the OpenAPI document.
healthRouter.get("/docs", async (c) => htmlPage(c, await snapshot(c), renderDocsPage));
