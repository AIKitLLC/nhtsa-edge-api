import { describe, it, expect } from "vitest";
import {
  validateVinCheckDigit,
  decodeModelYear,
  decodeWmi,
  decodeVinLocally,
} from "../src/services/local-decoder";
import { compareWithUpstream } from "../src/services/comparator";
import type { CompactVehicleSpec } from "../src/types/nhtsa";

describe("NHTSA Local Decoding Engine (49 CFR Part 565)", () => {
  describe("validateVinCheckDigit", () => {
    it("should validate clean VIN with correct mathematical check digit (ErrorCode 0)", () => {
      // 1FM5K8D84HGA00001 has check digit '4' at index 8
      const result = validateVinCheckDigit("1FM5K8D84HGA00001");
      expect(result.isValid).toBe(true);
      expect(result.expectedCheckDigit).toBe("4");
      expect(result.actualCheckDigit).toBe("4");
      expect(result.errorCode).toBe("0");
      expect(result.errorText).toBe("0 - VIN decoded clean");
    });

    it("should detect invalid check digit (ErrorCode 1)", () => {
      // Intentionally wrong check digit '9' instead of '4'
      const result = validateVinCheckDigit("1FM5K8D89HGA00001");
      expect(result.isValid).toBe(false);
      expect(result.expectedCheckDigit).toBe("4");
      expect(result.actualCheckDigit).toBe("9");
      expect(result.errorCode).toBe("1");
      expect(result.errorText).toContain("Check Digit (9th position) does not calculate properly");
    });

    it("should flag incomplete VIN shorter than 17 characters (ErrorCode 6)", () => {
      const result = validateVinCheckDigit("1FM5K8D8");
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("6");
      expect(result.errorText).toBe("6 - Incomplete VIN");
    });

    it("should reject illegal characters I, O, Q (ErrorCode 2)", () => {
      const result = validateVinCheckDigit("1FM5K8D84HGA0000I");
      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe("2");
      expect(result.errorText).toContain("Illegal character in VIN");
    });
  });

  describe("decodeModelYear", () => {
    it("should correctly decode 10th position model year", () => {
      expect(decodeModelYear("1FM5K8D84HGA00001")).toBe(2017); // H = 2017
      expect(decodeModelYear("5YJ3E1EB8NF000001")).toBe(2022); // N = 2022
      expect(decodeModelYear("1HGCR2F83PA000001")).toBe(2023); // P = 2023
      expect(decodeModelYear("5UXWX7C50RA000001")).toBe(2024); // R = 2024
      expect(decodeModelYear("WAUZZZF27SA000001")).toBe(2025); // S = 2025
    });

    it("should use the 1980-2009 cycle when position 7 is numeric", () => {
      expect(decodeModelYear("1HGCG5655WA027834")).toBe(1998); // W + numeric pos 7
      expect(decodeModelYear("1FAFP34N55W100000")).toBe(2005); // 5 + numeric pos 7
      expect(decodeModelYear("1G1ZT51816F100000")).toBe(2006); // 6 + numeric pos 7
    });

    it("should never return a model year beyond next calendar year", () => {
      const now = new Date("2026-09-27T00:00:00Z");
      // Alphabetic pos 7 but year code W (2028) is implausible in 2026 -> legacy 1998
      expect(decodeModelYear("WDBAB23A1WA000001", now)).toBe(1998);
      // V = 2027 is allowed (next model year)
      expect(decodeModelYear("1FM5K8D84VGA00001", now)).toBe(2027);
    });

    it("should pick the most recent plausible year for wildcard VINs", () => {
      const now = new Date("2026-09-27T00:00:00Z");
      expect(decodeModelYear("5UXWX7C5*BA", now)).toBe(2011);
      expect(decodeModelYear("5UXWX7*5*WA", now)).toBe(1998);
    });
  });

  describe("decodeWmi", () => {
    it("should resolve country and manufacturer from WMI", () => {
      const ford = decodeWmi("1FM5K8D84HGA00001");
      expect(ford.wmi).toBe("1FM");
      expect(ford.make).toBe("FORD");
      expect(ford.plantCountry).toBe("UNITED STATES (USA)");

      const tesla = decodeWmi("5YJ3E1EB8NF000001");
      expect(tesla.wmi).toBe("5YJ");
      expect(tesla.make).toBe("TESLA");
      expect(tesla.plantCountry).toBe("UNITED STATES (USA)");

      const bmwGermany = decodeWmi("WBA12345678901234");
      expect(bmwGermany.wmi).toBe("WBA");
      expect(bmwGermany.make).toBe("BMW");
      expect(bmwGermany.plantCountry).toBe("GERMANY");
    });
  });

  describe("decodeVinLocally", () => {
    it("should assemble a complete local vehicle structure", () => {
      const decoded = decodeVinLocally("1FM5K8D84HGA00001");
      expect(decoded.vin).toBe("1FM5K8D84HGA00001");
      expect(decoded.make).toBe("FORD");
      expect(decoded.year).toBe(2017);
      expect(decoded.plantCountry).toBe("UNITED STATES (USA)");
      expect(decoded.isValidCheckDigit).toBe(true);
      expect(decoded.nhtsaErrorCode).toBe("0");
    });
  });

  describe("Parity Comparison Engine (compareWithUpstream)", () => {
    it("should report 100% parity when local engine and upstream match", () => {
      const local = decodeVinLocally("1FM5K8D84HGA00001");
      const mockUpstream: CompactVehicleSpec = {
        vin: "1FM5K8D84HGA00001",
        make: "FORD",
        model: "Explorer",
        year: 2017,
        trim: "XLT",
        series: null,
        vehicleType: "MULTIPURPOSE PASSENGER VEHICLE (MPV)",
        bodyClass: "Sport Utility Vehicle [SUV]/Multipurpose Vehicle [MPV]",
        doors: 4,
        driveType: "4WD",
        engineCylinders: 6,
        displacementL: 3.5,
        engineHp: 290,
        fuelType: "Gasoline",
        electrificationLevel: null,
        plantCountry: "UNITED STATES (USA)",
        plantCity: "CHICAGO",
        manufacturer: "FORD MOTOR COMPANY, USA",
        isValidVin: true,
        errorCode: "0",
        errorText: "0 - VIN decoded clean",
        extraAttributes: {},
      };

      const report = compareWithUpstream(local, mockUpstream, 0.4, 250);
      expect(report.parityScorePercent).toBe(100);
      expect(report.isExactMatch).toBe(true);
      expect(report.latencyComparison.speedupMultiplier).toBeGreaterThan(100);
      expect(report.fieldAudits.every((a) => a.match)).toBe(true);
    });
  });
});
