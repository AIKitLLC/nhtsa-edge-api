import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";

const TEST_ENV = { ADMIN_TOKEN: "test-admin-token" };
const AUTH = { Authorization: "Bearer test-admin-token" };

describe("Dual-Channel Sync Router (/api/v1/sync)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/v1/sync/status", () => {
    it("should return operational status and fallback state when D1 is not bound", async () => {
      const res = await app.fetch(new Request("http://localhost/api/v1/sync/status"));
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json["status"]).toBe("operational");
      expect(json["d1DatabaseBound"]).toBe(false);
    });
  });

  describe("POST /api/v1/sync/models", () => {
    it("should require ?make parameter", async () => {
      const res = await app.fetch(new Request("http://localhost/api/v1/sync/models", { method: "POST", headers: AUTH }), TEST_ENV);
      expect(res.status).toBe(400);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(false);
    });

    it("should sync models from live API with valid response", async () => {
      const mockApiResponse = {
        Count: 2,
        Results: [
          { Make_ID: 441, Make_Name: "Tesla", Model_ID: 1, Model_Name: "Model 3" },
          { Make_ID: 441, Make_Name: "Tesla", Model_ID: 2, Model_Name: "Cybercab" },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockApiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await app.fetch(
        new Request("http://localhost/api/v1/sync/models?make=tesla", { method: "POST", headers: AUTH }), TEST_ENV
      );
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(true);
      expect(json["make"]).toBe("TESLA");
      expect((json["models"] as string[]).length).toBe(2);
    });
  });

  describe("POST /api/v1/sync/wmi", () => {
    it("should require ?wmi parameter", async () => {
      const res = await app.fetch(new Request("http://localhost/api/v1/sync/wmi", { method: "POST", headers: AUTH }), TEST_ENV);
      expect(res.status).toBe(400);
    });

    it("should sync specific WMI from live API", async () => {
      const mockWmiResponse = {
        Count: 1,
        Results: [
          {
            CommonName: "Tesla",
            Make: "TESLA",
            ManufacturerName: "TESLA, INC.",
            VehicleType: "Passenger Car",
            Country: "UNITED STATES (USA)",
          },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockWmiResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await app.fetch(
        new Request("http://localhost/api/v1/sync/wmi?wmi=5YJ", { method: "POST", headers: AUTH }), TEST_ENV
      );
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(true);
      const data = json["data"] as Record<string, unknown>;
      expect(data["wmi"]).toBe("5YJ");
      expect(data["make"]).toBe("TESLA");
    });
  });
});
