import { describe, it, expect } from "vitest";
import app from "../src/index";

const ENV = { ADMIN_TOKEN: "secret-token" };

describe("Admin authentication", () => {
  it("disables admin endpoints when ADMIN_TOKEN is not configured", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/v1/sync/incremental", { method: "POST" }),
      {}
    );
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("ADMIN_DISABLED");
  });

  it("rejects requests without a bearer token", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/v1/sync/incremental", { method: "POST" }),
      ENV
    );
    expect(res.status).toBe(401);
  });

  it("rejects requests with a wrong bearer token", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/v1/admin/seed", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-token" },
      }),
      ENV
    );
    expect(res.status).toBe(401);
  });

  it("lets a valid token through to the handler", async () => {
    // No D1 bound -> handler answers 400 D1_NOT_BOUND, proving auth passed
    const res = await app.fetch(
      new Request("http://localhost/api/v1/admin/seed", {
        method: "POST",
        headers: { Authorization: "Bearer secret-token" },
      }),
      ENV
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("D1_NOT_BOUND");
  });

  it("keeps read-only sync status public", async () => {
    const res = await app.fetch(new Request("http://localhost/api/v1/sync/status"), {});
    expect(res.status).toBe(200);
  });
});
