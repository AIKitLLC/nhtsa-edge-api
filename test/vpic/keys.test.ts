import { describe, it, expect } from "vitest";
import {
  buildVarKeys,
  formulaKeysMatch,
  formulaValue,
  patternKeysMatch,
  pgSubstring,
  sqlLike,
  sqlwildToRegex,
  toFormulaKeys,
  validCharsInKey,
  validCharsInRegex,
} from "../../src/vpic/keys";

describe("vPIC pattern keys (port of spvindecode_core / sqlwild_to_regex / fValidCharsInKey)", () => {
  it("builds var_keys from positions 4-8 and 10-17", () => {
    expect(buildVarKeys("1HGCM82633A004352")).toBe("CM826|3A004352");
    expect(buildVarKeys("5UXWX7C5*BA")).toBe("WX7C5|BA");
    expect(buildVarKeys("1HG")).toBe("");
  });

  it("implements PostgreSQL LIKE with '_' and '%'", () => {
    expect(sqlLike("CM826|3A004352", "CM8__%")).toBe(true);
    expect(sqlLike("CM826|3A004352", "CM9%")).toBe(false);
    expect(sqlLike("AB", "A")).toBe(false);
    expect(sqlLike("A.C", "A.C")).toBe(true);
    expect(sqlLike("ABC", "A.C")).toBe(false);
  });

  it("converts keys to the regex of vpic.sqlwild_to_regex", () => {
    expect(sqlwildToRegex("*[AB]|1")).toBe("^.[AB]\\|1.*");
    expect(sqlwildToRegex("[1-A]")).toBe("^[1A].*");
  });

  it("matches plain keys by LIKE and bracket keys by regex", () => {
    expect(patternKeysMatch("CM826|3A004352", "CM8")).toBe(true);
    expect(patternKeysMatch("CM826|3A004352", "*M8*6")).toBe(true);
    expect(patternKeysMatch("CM826|3A004352", "[AC]M")).toBe(true);
    expect(patternKeysMatch("CM826|3A004352", "[AB]M")).toBe(false);
    expect(patternKeysMatch("CM826|3A004352", "*****|[1-3]A")).toBe(true);
  });

  it("extracts formula values between the first and last '#'", () => {
    const varKeys = "AB123|4C567890";
    expect(toFormulaKeys(varKeys)).toBe("AB###|#C######");
    expect(formulaKeysMatch(toFormulaKeys(varKeys), "**##")).toBe(true);
    expect(formulaValue(varKeys, "**##")).toBe("12");
    expect(formulaValue(varKeys, "****#")).toBe("3");
  });

  it("follows PostgreSQL SUBSTRING semantics", () => {
    expect(pgSubstring("ABCDEF", 2, 3)).toBe("BCD");
    expect(pgSubstring("ABCDEF", 0, 2)).toBe("A");
    expect(pgSubstring("ABCDEF", 5)).toBe("EF");
  });

  it("lists valid characters per key position (strict mode)", () => {
    expect(validCharsInRegex("[A-C]")).toBe("ABC");
    expect(validCharsInRegex("[AB]")).toBe("AB");
    expect(validCharsInKey("A*[BC]#").map(([p, c]) => `${p}${c}`)).toEqual([
      "1A",
      "3B",
      "3C",
      ...[..."0123456789"].map((d) => `4${d}`),
    ]);
  });
});
