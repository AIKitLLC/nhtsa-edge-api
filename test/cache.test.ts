import { describe, it, expect } from "vitest";
import { normalizeCacheKey } from "../src/services/cache";

describe("Cache Service", () => {
  describe("normalizeCacheKey", () => {
    it("should sort query parameters deterministically", () => {
      const urlA = "https://example.com/api/v1/models?year=2021&make=toyota";
      const urlB = "https://example.com/api/v1/models?make=toyota&year=2021";

      const keyA = normalizeCacheKey(urlA);
      const keyB = normalizeCacheKey(urlB);

      expect(keyA).toBe(keyB);
      expect(keyA).toBe("https://example.com/api/v1/models?make=toyota&year=2021");
    });

    it("should handle URLs without query parameters", () => {
      const url = "https://example.com/api/v1/makes";
      expect(normalizeCacheKey(url)).toBe("https://example.com/api/v1/makes");
    });
  });
});
