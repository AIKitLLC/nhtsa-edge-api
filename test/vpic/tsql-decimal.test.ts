import { describe, it, expect } from "vitest";
import { evaluateDecimalExpression, parseDecimalLiteral } from "../../src/vpic/tsql-decimal";

describe("T-SQL decimal arithmetic for vpic.Conversion formulas", () => {
  it("types literals like SQL Server", () => {
    expect(parseDecimalLiteral("0.016387064")).toMatchObject({ precision: 9, scale: 9 });
    expect(parseDecimalLiteral("1000.")).toMatchObject({ precision: 4, scale: 0 });
    expect(parseDecimalLiteral("3500.0")).toMatchObject({ precision: 5, scale: 1 });
  });

  it("reproduces values returned by the live vPIC API", () => {
    // Observed in DecodeVinValues (DisplacementCI from DisplacementL)
    expect(evaluateDecimalExpression("2.4 / 0.016387064 ")).toBe("146.45698582735");
    expect(evaluateDecimalExpression("3.5 / 0.016387064 ")).toBe("213.58310433156");
    expect(evaluateDecimalExpression("1.4 / 0.016387064 ")).toBe("85.43324173262");
    // DisplacementCC / DisplacementL from DisplacementCI (1HGCM82633A004352)
    expect(evaluateDecimalExpression("183 * 16.387064 ")).toBe("2998.832712");
    expect(evaluateDecimalExpression("183 * 0.016387064 ")).toBe("2.998832712");
  });

  it("rejects anything that is not arithmetic on literals", () => {
    expect(() => evaluateDecimalExpression("2.4L / 1000.")).toThrow();
    expect(() => evaluateDecimalExpression(" / 1000.")).toThrow();
    expect(() => evaluateDecimalExpression("1 / 0")).toThrow();
  });
});
