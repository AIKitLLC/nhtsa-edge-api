import { describe, it, expect, vi } from "vitest";
import { app } from "../src/index";
import { testEnv } from "./helpers/assets";

const VIN = "1HGCM82633A004352";

/** A limiter that allows `allowed` calls per key, like the real binding. */
function limiter(allowed: number) {
  const seen = new Map<string, number>();
  return {
    limit: vi.fn(async ({ key }: { key: string }) => {
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      return { success: n <= allowed };
    }),
  };
}

const call = (path: string, env: object, ip = "203.0.113.7", init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { "CF-Connecting-IP": ip, ...(init.headers ?? {}) } }, env);

describe("Rate limit", () => {
  it("answers 429 with Retry-After once a client is over the limit, without touching other clients", async () => {
    const env = { ...testEnv(), RATE_LIMITER: limiter(2) };
    expect((await call(`/api/v1/vin/${VIN}`, env)).status).toBe(200);
    expect((await call(`/api/v1/vin/${VIN}`, env)).status).toBe(200);

    const blocked = await call(`/api/v1/vin/${VIN}`, env);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBe("60");
    expect(((await blocked.json()) as { error: { code: string } }).error.code).toBe("RATE_LIMITED");

    expect((await call(`/api/v1/vin/${VIN}`, env, "198.51.100.9")).status).toBe(200);
  });

  it("keeps CORS and branding headers on the 429, so browser clients can read it", async () => {
    const env = { ...testEnv(), RATE_LIMITER: limiter(0) };
    const res = await call(`/api/v1/vin/${VIN}`, env);
    expect(res.status).toBe(429);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("never limits the pages, /health or CORS preflights", async () => {
    const lim = limiter(0);
    const env = { ...testEnv(), RATE_LIMITER: lim };
    for (const path of ["/", "/health", "/vpic"]) {
      expect((await call(path, env)).status, path).toBe(200);
    }
    expect((await call(`/api/v1/vin/${VIN}`, env, "203.0.113.7", { method: "OPTIONS" })).status).toBe(204);
    expect(lim.limit).not.toHaveBeenCalled();
  });

  it("fails open when the binding is missing or throws", async () => {
    expect((await call(`/api/v1/vin/${VIN}`, testEnv())).status).toBe(200);

    const broken = { limit: vi.fn(async () => Promise.reject(new Error("down"))) };
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await call(`/api/v1/vin/${VIN}`, { ...testEnv(), RATE_LIMITER: broken })).status).toBe(200);
    spy.mockRestore();
  });
});
