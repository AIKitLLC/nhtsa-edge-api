import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";
import { testEnv } from "./helpers/assets";

const request = (path: string, init?: RequestInit) => app.request(path, init, testEnv());

function mockUpstreamOk(body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
  );
}

describe("Upstream proxy mechanics (non-decode vPIC endpoints, recalls)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("forwards only allow-listed params and defaults format=json", async () => {
    const fetchSpy = mockUpstreamOk({ Count: 0, Message: "ok", Results: [] });
    const res = await request("/vehicles/GetModelsForMakeYear/make/honda?modelyear=2020&cachebuster=42");
    expect(res.status).toBe(200);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/honda?format=json&modelyear=2020"
    );
  });

  it("strips empty fields when clean=true", async () => {
    mockUpstreamOk({ Count: 1, Message: "ok", Results: [{ Make: "HONDA", Trim: "", ABS: "Not Applicable" }] });
    const res = await request("/vehicles/GetAllMakes?clean=true");
    const json = (await res.json()) as { Results: Record<string, unknown>[] };
    expect(json.Results[0]).toEqual({ Make: "HONDA" });
  });

  it("proxies the Extended decode variants (private NCSA data is not bundled)", async () => {
    const fetchSpy = mockUpstreamOk({ Count: 1, Message: "ok", Results: [{}] });
    await request("/vehicles/DecodeVinValuesExtended/1HGCM82633A004352?format=json");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/vehicles/DecodeVinValuesExtended/1HGCM82633A004352");
  });

  it("proxies non-JSON formats of the decode endpoints", async () => {
    const fetchSpy = mockUpstreamOk({});
    await request("/vehicles/DecodeVinValues/1HGCM82633A004352?format=xml");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("format=xml");
  });

  it("rejects POST except the batch decode", async () => {
    expect((await request("/vehicles/GetAllMakes", { method: "POST" })).status).toBe(405);
  });

  it("passes upstream errors through with no-store", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));
    const res = await request("/vehicles/GetAllMakes");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("v1 recalls requires a full 17-character VIN", async () => {
    expect((await request("/api/v1/recalls/1HGCG5655WA")).status).toBe(400);
  });
});
