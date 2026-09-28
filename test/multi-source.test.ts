import { describe, it, expect, vi, afterEach } from "vitest";
import { app } from "../src/index";
import { fetchEpaEnergySpecs } from "../src/enrichment/epa";
import { fetchRdwEuropeanSpecs } from "../src/enrichment/rdw";
import { testEnv } from "./helpers/assets";

const request = (path: string) => app.request(path, undefined, testEnv());
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Stand-in for fueleconomy.gov and opendata.rdw.nl; anything else fails the test. */
function mockThirdParties(opts: { epaDown?: boolean } = {}) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("fueleconomy.gov")) {
      if (opts.epaDown) return new Response("Service Unavailable", { status: 503 });
      if (url.includes("menu/model")) {
        return json({ menuItem: [{ text: "Model 3 Long Range AWD", value: "Model 3 Long Range AWD" }, { text: "Model 3", value: "Model 3" }] });
      }
      if (url.includes("menu/options")) return json({ menuItem: { text: "Auto (A1)", value: "44583" } });
      if (url.includes("vehicle/44583")) {
        return json({ atvType: "EV", fuelType: "Electricity", range: "272", comb08: "132", evMotor: "211 kW AC PMSM", charge240: "10", co2: "0" });
      }
    }
    if (url.includes("opendata.rdw.nl")) {
      return json([
        {
          merk: "TESLA",
          handelsbenaming: "MODEL 3",
          massa_ledig_voertuig: "1745",
          toegestane_maximum_massa_voertuig: "2232",
          typegoedkeuringsnummer: "e4*2007/46*1293*28",
          europese_voertuigcategorie: "M1",
          wielbasis: "288",
          openstaande_terugroepactie_indicator: "Ja",
        },
      ]);
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("EPA FuelEconomy.gov enrichment", () => {
  it("prefers the exact model name and parses EV figures", async () => {
    mockThirdParties();
    const epa = await fetchEpaEnergySpecs("TESLA", "Model 3", 2022);
    expect(epa.outcome).toBe("matched");
    expect(epa.data).toMatchObject({
      epaModel: "Model 3",
      epaVehicleId: "44583",
      isElectricVehicle: true,
      electricRangeMiles: 272,
      electricRangeKm: 438,
      combinedMpgOrMpge: 132,
      chargeTimeHours240V: 10,
      co2GramsPerMile: 0,
      matchLevel: "model-year",
    });
  });

  it("reports a failure as 'error', not as 'no-match'", async () => {
    mockThirdParties({ epaDown: true });
    expect(await fetchEpaEnergySpecs("TESLA", "Model 3", 2022)).toEqual({ outcome: "error", data: null });
  });

  it("reports an unknown model as 'no-match'", async () => {
    mockThirdParties();
    expect(await fetchEpaEnergySpecs("TESLA", "Cybertruck", 2022)).toEqual({ outcome: "no-match", data: null });
  });
});

describe("EU RDW enrichment", () => {
  it("returns model-level data only (no per-registration recall flag)", async () => {
    mockThirdParties();
    const eu = await fetchRdwEuropeanSpecs("TESLA", "Model 3");
    expect(eu.outcome).toBe("matched");
    expect(eu.data).toEqual({
      euTypeApprovalNumber: "e4*2007/46*1293*28",
      europeanVehicleCategory: "M1",
      curbWeightKg: 1745,
      grossVehicleWeightKg: 2232,
      maxTowingWeightUnbrakedKg: undefined,
      wheelbaseCm: 288,
      matchLevel: "make-model",
    });
  });
});

describe("GET /api/v1/vin/:vin/unified", () => {
  it("combines the offline decode with EPA and RDW, without calling NHTSA", async () => {
    const spy = mockThirdParties();
    const res = await request("/api/v1/vin/5YJ3E1EB8NF000001/unified");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toMatch(/max-age=/);

    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ vin: "5YJ3E1EB8NF000001", make: "TESLA", model: "Model 3", year: 2022 });
    expect(body.data["provenance"]).toMatchObject({
      primarySource: "LOCAL_VPIC",
      enrichment: { epa: "matched", eu: "matched" },
      enrichedSources: ["US_EPA_FUELECONOMY", "EU_RDW_OPENDATA"],
    });
    expect(spy.mock.calls.map(([u]) => String(u)).some((u) => u.includes("nhtsa"))).toBe(false);
  });

  it("is not cacheable when an enrichment failed transiently", async () => {
    mockThirdParties({ epaDown: true });
    const res = await request("/api/v1/vin/5YJ3E1EB8NF000001/unified?eu=false");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { data: { energy: unknown; provenance: Record<string, unknown> } };
    expect(body.data.energy).toBeNull();
    expect(body.data.provenance["enrichment"]).toEqual({ epa: "error", eu: "skipped" });
  });

  it("skips both enrichments on request and makes no network call", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = await request("/api/v1/vin/5YJ3E1EB8NF000001/unified?epa=false&eu=false");
    expect(res.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects an invalid VIN", async () => {
    const res = await request("/api/v1/vin/!!/unified");
    expect(res.status).toBe(400);
  });
});

describe("Branding", () => {
  it("serves the landing page to browsers and JSON to API clients", async () => {
    const html = await app.request("/", { headers: { Accept: "text/html" } }, testEnv());
    expect(html.headers.get("Content-Type")).toMatch(/text\/html/);
    const page = await html.text();
    expect(page).toContain("AI Kit LLC");
    expect(page).toMatch(/vPICList_lite_/);

    const api = await request("/");
    expect(api.headers.get("X-Powered-By")).toMatch(/AI Kit LLC/);
    expect(((await api.json()) as { project: { repository: string } }).project.repository).toContain("AIKitLLC");
  });
});
