import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect, vi, afterEach } from "vitest";
import { app } from "../src/index";
import { OPENAPI } from "../src/routes/openapi/spec";
import { testEnv } from "./helpers/assets";

const SECRET = "test-rapidapi-proxy-secret";
const HONDA = "1HGCM82633A004352";
const TESLA = "5YJ3E1EB1NF000001";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function rapidEnv(extra: Record<string, unknown> = {}) {
  return { ...testEnv(), RAPIDAPI_PROXY_SECRET: SECRET, ...extra };
}

function postBatch(
  body: unknown,
  headers: Record<string, string> = {},
  extra: Record<string, unknown> = {},
  includeSecret = true
) {
  return app.request(
    "/rapid/v1/batch",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(includeSecret ? { "X-RapidAPI-Proxy-Secret": SECRET } : {}),
        "X-RapidAPI-User": "user-1",
        "X-RapidAPI-Subscription": "BASIC",
        ...headers,
      },
      body: JSON.stringify(body),
    },
    rapidEnv(extra)
  );
}

function mockSources(opts: { recallStatus?: number; epaDown?: boolean } = {}) {
  const seen: { url: string; apiKey: string | null }[] = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push({ url, apiKey: new Headers(init?.headers).get("X-Api-Key") });
    if (url.includes("api.nhtsa.gov/recalls/recallsByVin")) {
      if ((opts.recallStatus ?? 200) !== 200) return new Response("down", { status: opts.recallStatus });
      return json({
        Count: 1,
        Message: "Results returned successfully",
        results: [{ NHTSACampaignNumber: "23V123000", Component: "AIR BAGS" }],
      });
    }
    if (url.includes("fueleconomy.gov")) {
      if (opts.epaDown) return new Response("down", { status: 503 });
      if (url.includes("menu/model")) {
        return json({
          menuItem: [
            { text: "Accord", value: "Accord" },
            { text: "Model 3", value: "Model 3" },
          ],
        });
      }
      if (url.includes("menu/options")) return json({ menuItem: { text: "Auto", value: "10001" } });
      if (url.includes("vehicle/10001")) {
        return json({
          atvType: "EV",
          fuelType: "Electricity",
          range: "272",
          comb08: "132",
          evMotor: "211 kW AC PMSM",
          charge240: "10",
          co2: "0",
        });
      }
    }
    throw new Error(`unexpected fetch ${url}`);
  });
  return { spy, seen };
}

afterEach(() => vi.restoreAllMocks());

describe("POST /rapid/v1/batch proxy secret", () => {
  it("returns 403 when the proxy secret header is missing", async () => {
    const { spy } = mockSources();
    const res = await postBatch({ vins: [{ vin: HONDA }] }, {}, {}, false);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("RAPIDAPI_PROXY_REQUIRED");
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns 403 when the proxy secret is wrong or the Worker secret is unset", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const wrong = await postBatch({ vins: [{ vin: HONDA }] }, { "X-RapidAPI-Proxy-Secret": "not-the-secret" });
    expect(wrong.status).toBe(403);
    expect(JSON.stringify(await wrong.json())).not.toContain("not-the-secret");

    const unset = await app.request(
      "/rapid/v1/batch",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-RapidAPI-Proxy-Secret": SECRET },
        body: JSON.stringify({ vins: [{ vin: HONDA }] }),
      },
      testEnv()
    );
    expect(unset.status).toBe(403);
    expect(info.mock.calls.map((call) => call.join(" ")).join("\n")).not.toContain(SECRET);
    expect(info.mock.calls.map((call) => call.join(" ")).join("\n")).not.toContain("not-the-secret");
  });

  it("returns 200 for a matching secret and logs the RapidAPI user headers", async () => {
    mockSources();
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const res = await postBatch({ vins: [{ vin: HONDA }] }, { "x-rapidapi-proxy-secret": SECRET }, {}, false);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Decode-Source")).toBe("LOCAL_VPIC");

    const body = (await res.json()) as {
      success: boolean;
      data: {
        count: number;
        results: {
          decode: { make: string; model: string; modelYear: number };
          recalls: { outcome: string; count: number; campaigns: { NHTSACampaignNumber: string }[] };
          fuel: { outcome: string; data: { combinedMpgOrMpge: number; epaVehicleId: string } | null };
        }[];
      };
    };
    expect(body.success).toBe(true);
    expect(body.data.count).toBe(1);
    expect(body.data.results[0]?.decode).toMatchObject({ make: "HONDA", model: "Accord", modelYear: 2003 });
    expect(body.data.results[0]?.recalls).toMatchObject({
      outcome: "provided",
      count: 1,
      campaigns: [{ NHTSACampaignNumber: "23V123000" }],
    });
    expect(body.data.results[0]?.fuel).toMatchObject({
      outcome: "matched",
      data: { epaVehicleId: "10001", combinedMpgOrMpge: 132 },
    });

    const logged = info.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(logged).toContain("user-1");
    expect(logged).toContain("BASIC");
    expect(logged).not.toContain(SECRET);
  });
});

describe("POST /rapid/v1/batch limits and upstream sections", () => {
  it("accepts the configured batch size and rejects one more, including the ceiling", async () => {
    mockSources();
    const two = await postBatch(
      { vins: [{ vin: HONDA }, { vin: TESLA, modelYear: 2022 }] },
      {},
      { RAPIDAPI_BATCH_MAX: "2" }
    );
    expect(two.status).toBe(200);
    const twoBody = (await two.json()) as { data: { results: { decode: { make: string } }[] } };
    expect(twoBody.data.results.map((row) => row.decode.make)).toEqual(["HONDA", "TESLA"]);

    const three = await postBatch(
      { vins: [{ vin: HONDA }, { vin: HONDA }, { vin: HONDA }] },
      {},
      { RAPIDAPI_BATCH_MAX: "2" }
    );
    expect(three.status).toBe(400);
    expect(((await three.json()) as { error: { code: string } }).error.code).toBe("BATCH_TOO_LARGE");

    const overCeiling = await postBatch(
      { vins: Array.from({ length: 201 }, () => ({ vin: HONDA })) },
      {},
      { RAPIDAPI_BATCH_MAX: "9999" }
    );
    expect(overCeiling.status).toBe(400);
    expect(((await overCeiling.json()) as { error: { message: string } }).error.message).toContain("200");
  });

  it("accepts 51 VINs by default, which the public batch endpoint rejects", async () => {
    mockSources();
    const rapid = await postBatch({ vins: Array.from({ length: 51 }, () => ({ vin: HONDA })) });
    expect(rapid.status).toBe(200);
    expect(((await rapid.json()) as { data: { count: number } }).data.count).toBe(51);

    const tooMany = await postBatch({ vins: Array.from({ length: 101 }, () => ({ vin: HONDA })) });
    expect(tooMany.status).toBe(400);
  });

  it("leaves recalls and fuel empty when those sources do not provide them", async () => {
    mockSources({ recallStatus: 500, epaDown: true });
    const partial = await postBatch({ vins: [{ vin: "1HGCM82633A00435" }] });
    expect(partial.status).toBe(200);
    const partialBody = (await partial.json()) as { data: { results: { recalls: { outcome: string } }[] } };
    expect(partialBody.data.results[0]?.recalls.outcome).toBe("skipped");

    const down = await postBatch({ vins: [{ vin: HONDA }] });
    expect(down.status).toBe(200);
    const downBody = (await down.json()) as {
      data: { results: { recalls: { outcome: string }; fuel: { outcome: string; data: null } }[] };
    };
    expect(downBody.data.results[0]?.recalls.outcome).toBe("unavailable");
    expect(downBody.data.results[0]?.fuel).toEqual({ outcome: "error", data: null });
  });

  it("sends the data.gov key only to api.nhtsa.gov", async () => {
    const key = "test-data-gov-key-12345";
    const { seen } = mockSources();
    const res = await postBatch({ vins: [{ vin: HONDA }] }, {}, { DATA_GOV_API_KEY: key });
    expect(res.status).toBe(200);
    const nhtsa = seen.filter((call) => call.url.includes("api.nhtsa.gov"));
    const epa = seen.filter((call) => call.url.includes("fueleconomy.gov"));
    expect(nhtsa.length).toBeGreaterThan(0);
    expect(nhtsa.every((call) => call.apiKey === key && !call.url.includes(key))).toBe(true);
    expect(epa.length).toBeGreaterThan(0);
    expect(epa.every((call) => call.apiKey === null)).toBe(true);
  });
});

describe("public endpoints stay the same", () => {
  it("decodes and batches without the RapidAPI secret, and the public batch limit stays 50", async () => {
    const headers = { "X-RapidAPI-Proxy-Secret": "not-the-secret", "X-RapidAPI-User": "user-1" };
    const decode = await app.request(`/api/v1/vin/${HONDA}`, { headers }, rapidEnv({ RAPIDAPI_BATCH_MAX: "100" }));
    expect(decode.status).toBe(200);
    const decoded = (await decode.json()) as { data: { make: string; model: string; modelYear: number }; source: string };
    expect(decoded.source).toBe("LOCAL_VPIC");
    expect(decoded.data).toMatchObject({ make: "HONDA", model: "Accord", modelYear: 2003 });

    const batch = await app.request(
      "/vehicles/DecodeVINValuesBatch/",
      {
        method: "POST",
        headers,
        body: new URLSearchParams({ format: "json", data: Array(51).fill(HONDA).join(";") }),
      },
      rapidEnv({ RAPIDAPI_BATCH_MAX: "100" })
    );
    expect(batch.status).toBe(400);
    expect(((await batch.json()) as { error: { code: string } }).error.code).toBe("BATCH_TOO_LARGE");

    const openapi = await app.request("/openapi.json", undefined, testEnv());
    expect(openapi.status).toBe(200);
    expect(await openapi.text()).not.toContain("/rapid/");
    expect(Object.keys(OPENAPI.paths).some((path) => path.startsWith("/rapid"))).toBe(false);
  });

  it("keeps the public route fail-closed when the rate limiter is missing", async () => {
    const assets = testEnv().ASSETS;
    const publicRoute = await app.request(`/api/v1/vin/${HONDA}`, undefined, { ASSETS: assets, RAPIDAPI_PROXY_SECRET: SECRET });
    expect(publicRoute.status).toBe(503);

    mockSources();
    const rapid = await app.request(
      "/rapid/v1/batch",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-RapidAPI-Proxy-Secret": SECRET },
        body: JSON.stringify({ vins: [{ vin: HONDA }] }),
      },
      { ASSETS: assets, RAPIDAPI_PROXY_SECRET: SECRET }
    );
    expect(rapid.status).toBe(200);
  });
});

describe("RapidAPI OpenAPI document", () => {
  it("describes POST /rapid/v1/batch and does not contain a secret value", () => {
    const spec = JSON.parse(readFileSync(resolve(__dirname, "../openapi/rapidapi.json"), "utf-8")) as {
      openapi: string;
      servers: { url: string }[];
      paths: Record<string, { post?: { operationId?: string } }>;
    };
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.servers[0]?.url).toBe("https://data.ai-kit.net");
    expect(spec.paths["/rapid/v1/batch"]?.post?.operationId).toBe("rapidBatchDecode");
    expect(JSON.stringify(spec)).not.toContain(SECRET);
    expect(JSON.stringify(spec)).not.toContain("RAPIDAPI_PROXY_SECRET=");
  });
});
