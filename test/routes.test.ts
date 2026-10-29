import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { app } from "../src/index";
import { testEnv } from "./helpers/assets";

function installMemoryCache(): void {
  const store = new Map<string, Response>();
  vi.stubGlobal("caches", {
    default: {
      async match(key: string) {
        const found = store.get(String(key));
        return found ? found.clone() : undefined;
      },
      async put(key: string, response: Response) {
        store.set(String(key), response.clone());
      },
    },
  });
}

const request = (path: string, init?: RequestInit) => app.request(path, init, testEnv());

function mockUpstreamOk(body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } })
  );
}

describe("Upstream proxy mechanics (non-decode vPIC endpoints, recalls)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards only allow-listed params and defaults format=json", async () => {
    const fetchSpy = mockUpstreamOk({ Count: 0, Message: "ok", Results: [] });
    const res = await request("/vehicles/GetModelsForMakeYear/make/honda?modelyear=2020&cachebuster=42");
    expect(res.status).toBe(200);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://vpic.nhtsa.dot.gov/api/vehicles/getmodelsformakeyear/make/honda?format=json&modelyear=2020"
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
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/vehicles/decodevinvaluesextended/1hgcm82633a004352");
  });

  it("proxies non-JSON formats of the decode endpoints", async () => {
    const fetchSpy = mockUpstreamOk({});
    await request("/vehicles/DecodeVinValues/1HGCM82633A004352?format=xml");
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("format=xml");
  });

  it("rejects POST except the batch decode", async () => {
    expect((await request("/vehicles/GetAllMakes", { method: "POST" })).status).toBe(405);
  });

  it("rejects paths that are not on the allowlist and does not call upstream", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const paths = [
      "/vehicles/NotAnEndpoint",
      "/vehicles/GetAllMakes/extra",
      "/vehicles/GetAllMakes/%5c",
      "/vehicles/" + "a".repeat(81),
      "/recalls/notARealEndpoint",
      "/recalls/recallsByVehicle/extra",
    ];
    for (const path of paths) {
      const res = await request(path);
      expect(res.status, path).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("INVALID_UPSTREAM_PATH");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches allowed responses, including upstream errors, so a repeat does not call upstream", async () => {
    installMemoryCache();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ Count: 0, Results: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response("not found", { status: 404 }));

    const ok1 = await request("/vehicles/GetAllMakes");
    const ok2 = await request("/vehicles/GetAllMakes");
    expect(ok1.status).toBe(200);
    expect(ok1.headers.get("Cache-Control")).toContain("max-age=");
    expect(ok2.headers.get("X-Cache-Status")).toBe("HIT");

    const missing = await request("/vehicles/GetParts");
    const missingAgain = await request("/vehicles/GetParts");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("Cache-Control")).toContain("max-age=60");
    expect(missingAgain.status).toBe(404);
    expect(missingAgain.headers.get("X-Cache-Status")).toBe("HIT");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("sends the data.gov key only to api.nhtsa.gov, and only as a header", async () => {
    const key = "test-data-gov-key-12345";
    const seen: { url: string; header: string | null }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      seen.push({ url, header: new Headers(init?.headers).get("X-Api-Key") });
      return new Response(JSON.stringify({ Count: 0, Results: [] }), { status: 200 });
    });
    const env = { ...testEnv(), DATA_GOV_API_KEY: key };
    expect((await app.request("/vehicles/GetAllMakes", undefined, env)).status).toBe(200);
    expect((await app.request("/recalls/RECALLSBYVEHICLE?make=honda&model=accord&modelYear=2015", undefined, env)).status).toBe(200);

    expect(seen[0]?.url).toContain("vpic.nhtsa.dot.gov");
    expect(seen[0]?.header).toBeNull();
    expect(seen[1]?.url).toBe("https://api.nhtsa.gov/recalls/recallsByVehicle?make=Honda&model=accord&modelYear=2015");
    expect(seen[1]?.header).toBe(key);
    for (const call of seen) expect(call.url).not.toContain(key);
  });

  it("forwards Battery Type after decoding the path, and rejects values that are not in the catalog", async () => {
    const fetchSpy = mockUpstreamOk({ Count: 0, Results: [] });
    const ok = await request("/vehicles/GetVehicleVariableValuesList/Battery%20Type");
    expect(ok.status).toBe(200);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toContain("/vehicles/getvehiclevariablevalueslist/battery%20type");

    const bad = [
      "/vehicles/GetAllMakes?format=yaml",
      "/vehicles/GetAllMakes?year=15",
      "/vehicles/GetAllMakes?modelyear=201",
      "/vehicles/GetAllMakes?page=0",
      "/vehicles/GetAllMakes?page=1000",
      "/vehicles/GetModelsForMake/NotARealMakeZZ",
      "/vehicles/GetVehicleVariableValuesList/NotARealVariable",
      "/vehicles/GetModelsForMakeYear/make/honda/modelyear/20",
      "/recalls/recallsByVehicle?make=not-a-real-make-zz",
      "/recalls/recallsByVehicle?make=Honda&campaignNumber=nope",
      "/recalls/recallsByVehicle?vin=1HGCM82633A00435",
      "/recalls/recallsByVehicle?vin=1HGCM82633A00435*",
      "/recalls/recallsByVin/1HGCG5655WA",
    ];
    for (const path of bad) {
      const res = await request(path);
      expect(res.status, path).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code, path).toBe("INVALID_QUERY");
    }
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects an oversized query value without calling upstream", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await request(`/vehicles/GetAllMakes?format=${"x".repeat(200)}`);
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("INVALID_QUERY");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("caches /compare so a second request does not call vPIC", async () => {
    installMemoryCache();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ Results: [{ Make: "HONDA" }] }), { status: 200 })
    );
    const first = await request("/api/v1/vin/1HGCM82633A004352/compare");
    const second = await request("/api/v1/vin/1HGCM82633A004352/compare");
    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toContain("max-age=");
    expect(first.headers.get("Cache-Control")).not.toBe("no-store");
    expect(first.headers.get("X-Cache-Status")).toBe("MISS");
    expect(second.headers.get("X-Cache-Status")).toBe("HIT");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const url = String(fetchSpy.mock.calls[0]?.[0]);
    expect(url).toContain("vpic.nhtsa.dot.gov");
    expect(url).not.toContain("api_key");
  });

  it("rejects a partial or wildcard VIN on /compare before calling vPIC", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    for (const vin of ["1HGCG5655WA", "1HGCM82633A00435*"]) {
      const res = await request(`/api/v1/vin/${encodeURIComponent(vin)}/compare`);
      expect(res.status, vin).toBe(400);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe("INVALID_VIN_FORMAT");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("v1 recalls requires a full 17-character VIN", async () => {
    expect((await request("/api/v1/recalls/1HGCG5655WA")).status).toBe(400);
  });
});
