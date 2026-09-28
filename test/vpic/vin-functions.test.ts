import { describe, it, expect } from "vitest";
import { vinCheckDigit, vinCheckDigit2, vinDescriptor, vinModelYear2, vinWmi } from "../../src/vpic/vin-functions";

const NOW = new Date("2026-09-27T00:00:00Z");
const CAR = { vehicleTypeId: 2, truckTypeId: null };
const TRAILER = { vehicleTypeId: 6, truckTypeId: null };

describe("vPIC scalar VIN functions", () => {
  it("fVinWMI uses 6 characters for low-volume manufacturers", () => {
    expect(vinWmi("1HGCM82633A004352")).toBe("1HG");
    expect(vinWmi("1K92STEP3RJ432140")).toBe("1K9432");
    expect(vinWmi("1K92STEP3RJ43")).toBe("1K9"); // shorter than 14
  });

  it("fVinDescriptor masks the check digit and pads with '*'", () => {
    expect(vinDescriptor("1HGCM82633A004352")).toBe("1HGCM826*3A");
    expect(vinDescriptor("1K92STEP3RJ432140")).toBe("1K92STEP*RJ432");
    expect(vinDescriptor("")).toBe("***********");
  });

  it("computes the 49 CFR 565 check digit", () => {
    expect(vinCheckDigit2("1HGCM82633A004352", true)).toBe("3");
    expect(vinCheckDigit("1HGCM82633A004352")).toBe("3");
    expect(vinCheckDigit2("1HGCM826I3A004352", true)).toBe("?"); // I is never valid
    expect(vinCheckDigit2("1HGCM826", true)).toBe("");
  });

  it("fVinModelYear2: conclusive for cars by position 7, negated when unsure", () => {
    expect(vinModelYear2("1HGCM82633A004352", CAR, NOW)).toBe(2003); // pos7 '6' numeric -> 1980-2009
    expect(vinModelYear2("5YJ3E1EA7KF317000", CAR, NOW)).toBe(2019); // pos7 'E' alpha -> 2010+
    expect(vinModelYear2("1C9FA3822R1257465", TRAILER, NOW)).toBe(-2024); // not a car: guess
    expect(vinModelYear2("1C9FA3822W1257465", TRAILER, NOW)).toBe(-2028); // 2028 is not > now+2: still a guess
    expect(vinModelYear2("1C9FA3822X1257465", TRAILER, NOW)).toBe(1999); // 2029 > now+2 -> -30, conclusive
    expect(vinModelYear2("1HGCM82630A004352", CAR, NOW)).toBeNull(); // '0' is no year code
  });
});
