import { describe, it, expect, vi } from "vitest";
import { app } from "../src/index";
import { testEnv } from "./helpers/assets";

const request = (path: string, init?: RequestInit) => app.request(path, init, testEnv());

describe("App: health, CORS, validation", () => {
  it("reports health with the bundled data version", async () => {
    const res = await request("/");
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json["status"]).toBe("healthy");
    expect(json["dataVersion"]).toMatch(/^vPICList_lite_\d{4}_\d{2}$/);
  });

  it("reports degraded (503) when the data assets are unreadable", async () => {
    // Fresh isolate state: the store caches the core asset once it has been read
    vi.resetModules();
    const { app: freshApp } = await import("../src/index");
    const broken = { ASSETS: { fetch: async () => new Response("", { status: 500 }) } as unknown as Fetcher };
    const res = await freshApp.request("/", undefined, broken);
    expect(res.status).toBe(503);
  });

  it("adds timing and CORS headers, answers preflight", async () => {
    const res = await request("/");
    expect(res.headers.get("Server-Timing")).toContain("edge;dur=");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const preflight = await request("/", { method: "OPTIONS" });
    expect(preflight.status).toBe(204);
  });

  it("rejects malformed VINs and model years with 400", async () => {
    expect((await request("/api/v1/vin/invalid%20vin!")).status).toBe(400);
    expect((await request("/api/v1/vin/1HGCM82633A0043521")).status).toBe(400); // 18 chars
    expect((await request("/api/v1/vin/1HGCM82633A004352?modelyear=20x3")).status).toBe(400);
    expect((await request("/api/v1/models")).status).toBe(400);
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request("/non-existent-endpoint");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("ROUTE_NOT_FOUND");
  });
});
