import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";

function mockFetchOk(body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
  );
}

describe("Route behaviour", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("VPIC proxy forwards only allow-listed params and defaults format=json", async () => {
    const fetchSpy = mockFetchOk({ Count: 0, Message: "ok", Results: [] });

    const res = await app.request("/vehicles/GetModelsForMakeYear/make/honda?modelyear=2020&cachebuster=42");
    expect(res.status).toBe(200);

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0]);
    expect(calledUrl).toBe(
      "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/honda?format=json&modelyear=2020"
    );
  });

  it("VPIC proxy strips empty fields when clean=true", async () => {
    mockFetchOk({ Count: 1, Message: "ok", Results: [{ Make: "HONDA", Trim: "", ABS: "Not Applicable" }] });

    const res = await app.request("/api/vehicles/DecodeVinValues/1HGCG5655WA027834?clean=true");
    const json = (await res.json()) as { Results: Record<string, unknown>[] };
    expect(json.Results[0]).toEqual({ Make: "HONDA" });
  });

  it("VPIC proxy does not answer non-GET methods", async () => {
    const res = await app.request("/vehicles/GetAllMakes", { method: "POST" });
    expect(res.status).toBe(404);
  });

  it("upstream errors are passed through with no-store", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not found", { status: 404 }));
    const res = await app.request("/vehicles/GetAllMakes");
    expect(res.status).toBe(404);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("v1 recalls rejects anything but a full 17-character VIN", async () => {
    const res = await app.request("/api/v1/recalls/1HGCG5655WA");
    expect(res.status).toBe(400);
  });

  it("v1 local decode returns the LocalDecodedVehicle shape without upstream calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await app.request("/api/v1/vin/1hgcg5655wa027834/local");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Record<string, unknown>; source: string };
    expect(json.data["vin"]).toBe("1HGCG5655WA027834");
    expect(json.data["year"]).toBe(1998);
    expect(json.data["wmi"]).toBe("1HG");
    expect(json.source).toBe("LOCAL_HEURISTIC");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("v1 models reads the bundled catalog case-insensitively", async () => {
    const res = await app.request("/api/v1/models?make=tesla");
    const json = (await res.json()) as { data: { make: string; count: number }; source: string };
    expect(json.source).toBe("LOCAL_NHTSA_CATALOG");
    expect(json.data.make).toBe("TESLA");
    expect(json.data.count).toBeGreaterThan(0);
  });

  it("v1 VIN decode maps an empty upstream result to 404", async () => {
    mockFetchOk({ Count: 0, Message: "ok", Results: [] });
    const res = await app.request("/api/v1/vin/1HGCG5655WA027834");
    expect(res.status).toBe(404);
  });
});
