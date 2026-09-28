import { describe, it, expect } from "vitest";
import { decodeVin } from "../../src/vpic/decode";
import { VpicStore } from "../../src/vpic/store";
import { fsAssets } from "../helpers/assets";

const store = new VpicStore({
  async readText(path: string) {
    const res = await fsAssets().fetch(new Request(`https://assets.invalid/${path}`));
    return res.status === 404 ? null : res.text();
  },
});

const modelYear = async (vin: string) =>
  (await decodeVin(store, vin)).elements.find((e) => e.code === "ModelYear")?.value ?? null;

describe("NHTSA errata fixed by the port (docs/NHTSA-ERRATA.md)", () => {
  // E1: VinDescriptor overrides. The dump's SQL returns the position-10 year
  // (2008 / 2011); the live API returns these, verified by the errata audit.
  it.each([
    ["KNDJH741485111111", "2009"],
    ["KNDJH742385111111", "2009"],
    ["KNDJJ741985111111", "2009"],
    ["KMHGC4DH8BU111111", "2012"],
  ])("E1: %s decodes to the VinDescriptor model year %s", async (vin, year) => {
    expect(await modelYear(vin)).toBe(year);
  });

  it("E1: VINs without a descriptor entry are unaffected", async () => {
    expect(await modelYear("1HGCM82633A004352")).toBe("2003");
  });
});
