import { describe, it, expect } from "vitest";
import { buildCacheKey, canonicalQuery } from "../src/services/cache";

describe("Cache Service", () => {
  describe("canonicalQuery", () => {
    it("keeps only allow-listed params, canonicalizes their names and sorts them", () => {
      const params = new URLSearchParams("ModelYear=2021&junk=1&FORMAT=json&cb=123");
      const result = canonicalQuery(params, ["format", "modelyear"]);
      expect(result.toString()).toBe("format=json&modelyear=2021");
    });

    it("drops empty values and keeps the first duplicate", () => {
      const params = new URLSearchParams("make=&model=a&model=b");
      expect(canonicalQuery(params, ["make", "model"]).toString()).toBe("model=a");
    });
  });

  describe("buildCacheKey", () => {
    it("is independent of how the client spelled the request URL", () => {
      const keyA = buildCacheKey("https://edge.example.com/api/v1/vin/abc?x=1", ["v1", "vin", "ABC"]);
      const keyB = buildCacheKey("https://edge.example.com/API/v1/vin/ABC?y=2", ["v1", "vin", "ABC"]);
      expect(keyA).toBe(keyB);
      expect(keyA).toBe("https://edge.example.com/__cache/v1/vin/ABC");
    });

    it("appends the canonical query when present", () => {
      const query = new URLSearchParams("format=json");
      expect(buildCacheKey("https://e.com/x", ["vpic", "/vehicles/getallmakes"], query)).toBe(
        "https://e.com/__cache/vpic/%2Fvehicles%2Fgetallmakes?format=json"
      );
    });
  });
});
