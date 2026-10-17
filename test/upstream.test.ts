import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchUpstream } from "../src/services/upstream";

describe("Upstream Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should coalesce concurrent identical in-flight requests into a single network call", async () => {
    let callCount = 0;
    const mockResponseText = JSON.stringify({ Count: 1, Results: [] });

    // Mock global fetch with a slight artificial delay
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return new Response(mockResponseText, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const testUrl = "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json";

    // Launch 5 concurrent calls simultaneously
    const results = await Promise.all([
      fetchUpstream(testUrl),
      fetchUpstream(testUrl),
      fetchUpstream(testUrl),
      fetchUpstream(testUrl),
      fetchUpstream(testUrl),
    ]);

    // Despite 5 requests, upstream fetch should have only been invoked once!
    expect(callCount).toBe(1);
    for (const res of results) {
      expect(res.status).toBe(200);
      expect(res.bodyText).toBe(mockResponseText);
    }
  });

  it("should retry on upstream 502/503 errors and succeed when it recovers", async () => {
    let callCount = 0;
    const successPayload = JSON.stringify({ ok: true });

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First attempt fails with 503
        return new Response("Service Unavailable", { status: 503 });
      }
      // Second attempt succeeds
      return new Response(successPayload, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });

    const res = await fetchUpstream("https://vpic.nhtsa.dot.gov/api/vehicles/flaky", {
      maxRetries: 2,
    });

    expect(callCount).toBe(2);
    expect(res.status).toBe(200);
    expect(res.bodyText).toBe(successPayload);
  });

  describe("api.data.gov API key", () => {
    const key = "test-data-gov-key-12345";

    it("sends the key only as X-Api-Key, and only to api.data.gov and api.nhtsa.gov", async () => {
      const { fetchJson } = await import("../src/enrichment/types");
      const seen: { url: string; header: string | null }[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
        const url = typeof input === "string" ? input : (input as Request).url;
        seen.push({ url, header: new Headers(init?.headers).get("X-Api-Key") });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      });

      const cases: { url: string; header: boolean }[] = [
        { url: "https://api.nhtsa.gov/recalls/recallsByVin?vin=1HGCR2F83HA", header: true },
        { url: "https://api.data.gov/nhtsa/recalls?vin=1", header: true },
        { url: "https://API.NHTSA.GOV/recalls/recallsByVehicle", header: true },
        { url: "https://api.nhtsa.gov:443/recalls/recallsByVin?vin=1", header: true },
        { url: "https://vpic.nhtsa.dot.gov/api/vehicles/GetAllMakes?format=json", header: false },
        { url: "https://www.fueleconomy.gov/ws/rest/vehicle/menu/model?year=2020&make=honda", header: false },
        { url: "https://opendata.rdw.nl/resource/m9d7-ebf2.json?merk=TESLA", header: false },
        { url: "https://evil.example/path?next=https://api.nhtsa.gov/", header: false },
        { url: "https://api.nhtsa.gov.evil.example/recalls", header: false },
        { url: "https://api.nhtsa.gov@evil.example/recalls", header: false },
        { url: "https://not-api.nhtsa.gov/recalls", header: false },
      ];

      for (const entry of cases) {
        await fetchUpstream(entry.url, { apiKey: key, headers: { "X-Api-Key": key } });
        await fetchJson(entry.url, key);
      }

      expect(seen).toHaveLength(cases.length * 2);
      seen.forEach((call, index) => {
        const expectHeader = cases[Math.floor(index / 2)]?.header;
        expect(call.url, call.url).not.toContain(key);
        expect(call.url.toLowerCase(), call.url).not.toContain("api_key=");
        expect(call.header, call.url).toBe(expectHeader ? key : null);
      });
    });

    it("strips an api_key query parameter even on an allowed host", async () => {
      let interceptedUrl = "";
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
        interceptedUrl = typeof input === "string" ? input : (input as Request).url;
        return new Response("{}", { status: 200 });
      });

      await fetchUpstream(`https://api.nhtsa.gov/recalls/recallsByVin?vin=1&api_key=${key}`, { apiKey: key });
      expect(interceptedUrl).not.toContain(key);
      expect(interceptedUrl).toContain("vin=1");
    });
  });
});
