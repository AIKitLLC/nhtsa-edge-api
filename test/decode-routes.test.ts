import { describe, it, expect, vi, afterEach } from "vitest";
import { app } from "../src/index";
import { testEnv } from "./helpers/assets";

const request = (path: string, init?: RequestInit) => app.request(path, init, testEnv());

afterEach(() => vi.restoreAllMocks());

describe("Offline decode endpoints (real vPIC data, no upstream calls)", () => {
  it("GET /api/v1/vin/:vin decodes offline with typed fields", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await request("/api/v1/vin/1hgcm82633a004352");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Vpic-Data-Version")).toMatch(/^vPICList_lite_/);

    const json = (await res.json()) as { data: Record<string, unknown>; source: string };
    expect(json.source).toBe("LOCAL_VPIC");
    expect(json.data).toMatchObject({
      vin: "1HGCM82633A004352",
      make: "HONDA",
      model: "Accord",
      modelYear: 2003,
      trim: "EX-V6",
      engineCylinders: 6,
      isCleanDecode: true,
      errorCodes: [0],
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("GET /vehicles/DecodeVinValues/:vin?clean=true drops empty and 'Not Applicable' values", async () => {
    const res = await request("/vehicles/DecodeVinValues/1HGCM82633A004352?format=json&clean=true");
    const row = ((await res.json()) as { Results: Record<string, string>[] }).Results[0] ?? {};
    expect(row["Make"]).toBe("HONDA");
    expect(Object.values(row).some((v) => v === "" || v === "Not Applicable")).toBe(false);
    expect(row["BusType"]).toBeUndefined();
  });

  it("GET /vehicles/DecodeVinValues/:vin returns the vPIC envelope", async () => {
    const res = await request("/vehicles/DecodeVinValues/1HGCM82633A004352?format=json");
    expect(res.headers.get("X-Decode-Source")).toBe("LOCAL_VPIC");
    const json = (await res.json()) as { Count: number; SearchCriteria: string; Results: Record<string, string>[] };
    expect(json.Count).toBe(1);
    expect(json.SearchCriteria).toBe("VIN(s): 1HGCM82633A004352");
    const row = json.Results[0] ?? {};
    expect(row["Make"]).toBe("HONDA");
    expect(row["ModelYear"]).toBe("2003");
    expect(row["VIN"]).toBe("1HGCM82633A004352");
    expect(Object.values(row).every((v) => typeof v === "string")).toBe(true);
  });

  it("is case-insensitive on the path and serves /api/vehicles too", async () => {
    const res = await request("/api/vehicles/decodevinvalues/1HGCM82633A004352");
    expect(res.headers.get("X-Decode-Source")).toBe("LOCAL_VPIC");
  });

  it("GET /vehicles/DecodeVin/:vin returns one row per variable", async () => {
    const res = await request("/vehicles/DecodeVin/1HGCM82633A004352?format=json");
    const json = (await res.json()) as { Results: { Variable: string; Value: string | null; VariableId: number }[] };
    const make = json.Results.find((r) => r.Variable === "Make");
    expect(make).toMatchObject({ Value: "HONDA", VariableId: 26 });
  });

  it("POST /vehicles/DecodeVINValuesBatch/ decodes up to 50 VINs offline", async () => {
    const body = new URLSearchParams({ format: "json", data: "1HGCM82633A004352;5UXWX7C5*BA,2011" });
    const res = await request("/vehicles/DecodeVINValuesBatch/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const json = (await res.json()) as { Count: number; Results: Record<string, string>[] };
    expect(json.Count).toBe(2);
    expect(json.Results[1]?.["Make"]).toBe("BMW");

    const tooMany = new URLSearchParams({ format: "json", data: Array(51).fill("1HGCM82633A004352").join(";") });
    const rejected = await request("/vehicles/DecodeVINValuesBatch/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tooMany.toString(),
    });
    expect(rejected.status).toBe(400);
  });

  it("serves makes and models from the bundled catalog", async () => {
    const makes = (await (await request("/api/v1/makes")).json()) as { count: number };
    expect(makes.count).toBeGreaterThan(10000);

    const res = await request("/api/v1/models?make=tesla");
    const json = (await res.json()) as { data: { make: string; models: { name: string }[] }[] };
    expect(json.data[0]?.make.toUpperCase()).toBe("TESLA");
    expect(json.data[0]?.models.map((m) => m.name)).toContain("Model 3");

    expect((await request("/api/v1/models?make=no-such-make")).status).toBe(404);
  });
});
