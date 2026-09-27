import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/index";

describe("NHTSA Edge API Integration Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Health & Root Route", () => {
    it("should return 200 with service metadata and documentation", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json["status"]).toBe("healthy");
      expect(json["name"]).toBe("NHTSA Edge API & High-Performance Cache");
      expect(json["documentation"]).toBeDefined();
    });

    it("should include timing headers", async () => {
      const res = await app.request("/");
      expect(res.headers.get("X-Response-Time-Ms")).toBeDefined();
      expect(res.headers.get("Server-Timing")).toContain("edge;dur=");
    });

    it("should include CORS headers", async () => {
      const res = await app.request("/");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should handle OPTIONS preflight with 204 No Content", async () => {
      const res = await app.request("/", { method: "OPTIONS" });
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("Validation & Error Boundaries", () => {
    it("should reject invalid VIN parameter with 400 Bad Request", async () => {
      const res = await app.request("/api/v1/vin/invalid%20vin%20with%20spaces!");
      expect(res.status).toBe(400);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(false);
      expect((json["error"] as Record<string, unknown>)["code"]).toBe("INVALID_VIN_FORMAT");
    });

    it("should reject /api/v1/models without make query parameter with 400 Bad Request", async () => {
      const res = await app.request("/api/v1/models");
      expect(res.status).toBe(400);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(false);
      expect((json["error"] as Record<string, unknown>)["code"]).toBe("MISSING_MAKE");
    });

    it("should return 404 for unknown endpoints", async () => {
      const res = await app.request("/non-existent-endpoint");
      expect(res.status).toBe(404);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(false);
      expect((json["error"] as Record<string, unknown>)["code"]).toBe("ROUTE_NOT_FOUND");
    });
  });

  describe("V1 VIN Decoding", () => {
    it("should decode VIN and return compact vehicle data", async () => {
      const mockVpicData = {
        Count: 1,
        Message: "Results returned successfully.",
        SearchCriteria: "VIN(s): 1HGCR2F83HA",
        Results: [
          {
            VIN: "1HGCR2F83HA",
            Make: "HONDA",
            Model: "Accord",
            ModelYear: "2017",
            Trim: "EX-L",
            Doors: "4",
            EngineCylinders: "4",
            DisplacementL: "2.4",
            FuelTypePrimary: "Gasoline",
            ErrorCode: "0",
            ErrorText: "0 - VIN decoded clean",
            ABS: "",
          },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify(mockVpicData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await app.request("/api/v1/vin/1HGCR2F83HA");
      expect(res.status).toBe(200);

      const json = await res.json() as Record<string, unknown>;
      expect(json["success"]).toBe(true);

      const data = json["data"] as Record<string, unknown>;
      expect(data["make"]).toBe("HONDA");
      expect(data["model"]).toBe("Accord");
      expect(data["year"]).toBe(2017);
      expect(data["doors"]).toBe(4);
      expect(data["engineCylinders"]).toBe(4);
      expect(data["displacementL"]).toBe(2.4);
      expect(data["isValidVin"]).toBe(true);
    });
  });
});
