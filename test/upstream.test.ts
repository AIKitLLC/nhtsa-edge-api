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
});
