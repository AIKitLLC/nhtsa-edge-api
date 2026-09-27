import { describe, it, expect, vi, beforeEach } from "vitest";
import { app } from "../src/index";

describe("Error boundary", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("maps upstream timeouts to 504 without leaking the upstream URL", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    });

    const res = await app.request("/api/v1/vin/1HGCG5655WA027834");
    expect(res.status).toBe(504);

    const body = await res.text();
    expect(body).toContain("UPSTREAM_TIMEOUT");
    expect(body).not.toContain("vpic.nhtsa.dot.gov");
  });

  it("maps unexpected failures to a generic 500", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("secret internal detail"));

    const res = await app.request("/api/v1/vin/1HGCG5655WA027834");
    expect(res.status).toBe(500);

    const body = await res.text();
    expect(body).toContain("INTERNAL_SERVER_ERROR");
    expect(body).not.toContain("secret internal detail");
  });
});
