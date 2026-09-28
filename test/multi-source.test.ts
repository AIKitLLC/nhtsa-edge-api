import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";
import {
  resolveUnifiedVehicle,
  fetchEpaEnergySpecs,
  fetchRdwEuropeanSpecs,
} from "../src/services/multi-source-resolver";

describe("Multi-Source Vehicle Resolver & Intelligent Fallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Fallback to Local Engine when Upstream NHTSA Fails", () => {
    it("should gracefully fall back to local 49 CFR Part 565 engine if NHTSA returns 503", async () => {
      // Mock fetch to simulate NHTSA 503 Service Unavailable
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("vpic.nhtsa.dot.gov")) {
          return new Response("Service Unavailable", { status: 503 });
        }
        return new Response("Not Found", { status: 404 });
      });

      // Ford VIN: 1FM5K8D84HGA00001
      const result = await resolveUnifiedVehicle("1FM5K8D84HGA00001", undefined, {
        enrichWithEpa: false,
        enrichWithEu: false,
      });

      expect(result.provenance.primarySource).toBe("LOCAL_FALLBACK");
      expect(result.provenance.fallbackTriggered).toBe(true);
      expect(result.make).toBe("FORD");
      expect(result.plantCountry).toBe("UNITED STATES (USA)");
      expect(result.year).toBe(2017);
      expect(result.isValidVin).toBe(true);
    });

    it("should return graceful fallback on /api/v1/vin/:vin when upstream returns 500", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("vpic.nhtsa.dot.gov")) {
          return new Response("Internal Server Error", { status: 500 });
        }
        return new Response("{}", { status: 200 });
      });

      const res = await app.request("/api/v1/vin/5YJ3E1EB8NF000001");
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(true);
      expect(json["source"]).toBe("LOCAL_FALLBACK");

      const data = json["data"] as Record<string, unknown>;
      expect(data["make"]).toBe("TESLA");
      expect(data["year"]).toBe(2022);
    });
  });

  describe("EPA FuelEconomy & EV Range Enrichment", () => {
    it("should parse EV range and MPGe from mocked EPA responses", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("menu/model")) {
          return new Response(JSON.stringify({ menuItem: [{ text: "Model 3 Long Range", value: "Model 3 Long Range" }] }), { status: 200 });
        }
        if (url.includes("menu/options")) {
          return new Response(JSON.stringify({ menuItem: [{ text: "Auto", value: "47908" }] }), { status: 200 });
        }
        if (url.includes("vehicle/47908")) {
          return new Response(JSON.stringify({
            atvType: "EV",
            fuelType: "Electricity",
            range: "342",
            comb08: "130",
            evMotor: "84 and 191 kW ACPM",
            charge240: "9.4",
            co2: "0",
          }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      const specs = await fetchEpaEnergySpecs("Tesla", "Model 3", 2024);
      expect(specs.isElectricVehicle).toBe(true);
      expect(specs.electricRangeMiles).toBe(342);
      expect(specs.electricRangeKm).toBe(550);
      expect(specs.combinedMpgOrMpge).toBe(130);
      expect(specs.energySource).toBe("EPA_FUELECONOMY");
    });
  });

  describe("RDW European Technical Specs Enrichment", () => {
    it("should parse EU type approval and weights from mocked RDW Open Data", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("opendata.rdw.nl")) {
          return new Response(JSON.stringify([{
            merk: "PEUGEOT",
            handelsbenaming: "PARTNER",
            massa_ledig_voertuig: "1292",
            toegestane_maximum_massa_voertuig: "1970",
            typegoedkeuringsnummer: "e2*2007/46*0001*30",
            europese_voertuigcategorie: "N1",
            wielbasis: "273",
            openstaande_terugroepactie_indicator: "Nee",
          }]), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      const euSpecs = await fetchRdwEuropeanSpecs("PEUGEOT", "PARTNER");
      expect(euSpecs.euSource).toBe("EU_RDW");
      expect(euSpecs.euTypeApprovalNumber).toBe("e2*2007/46*0001*30");
      expect(euSpecs.curbWeightKg).toBe(1292);
      expect(euSpecs.grossVehicleWeightKg).toBe(1970);
      expect(euSpecs.wheelbaseCm).toBe(273);
      expect(euSpecs.openRecallIndicatorEu).toBe(false);
    });
  });

  describe("GET /api/v1/vin/:vin/unified Route Integration", () => {
    it("should return unified profile with provenance metadata", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("vpic.nhtsa.dot.gov")) {
          return new Response(JSON.stringify({
            Count: 1,
            Results: [{
              Make: "TOYOTA",
              Model: "Camry",
              ModelYear: "2018",
              VehicleType: "PASSENGER CAR",
              PlantCountry: "UNITED STATES (USA)",
              ErrorCode: "0",
            }],
          }), { status: 200 });
        }
        return new Response("{}", { status: 200 });
      });

      const res = await app.request("/api/v1/vin/4T1B11HK5JU000001/unified?epa=false&eu=false");
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(true);

      const data = json["data"] as Record<string, unknown>;
      expect(data["make"]).toBe("TOYOTA");
      expect(data["model"]).toBe("Camry");
      expect(data["year"]).toBe(2018);

      const provenance = data["provenance"] as Record<string, unknown>;
      expect(provenance["primarySource"]).toBe("NHTSA_VPIC");
      expect(provenance["fallbackTriggered"]).toBe(false);
    });
  });
});
