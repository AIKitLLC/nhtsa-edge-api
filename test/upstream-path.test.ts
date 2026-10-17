import { describe, it, expect } from "vitest";
import { allowRecallsPath, allowVehiclesPath, encodeUpstreamPath } from "../src/validation/upstream-path";

describe("upstream path allowlist", () => {
  it("accepts published vPIC endpoints and lowercases them", () => {
    expect(allowVehiclesPath("/vehicles/GetAllMakes")).toEqual({ ok: true, canonicalPath: "/vehicles/getallmakes" });
    expect(allowVehiclesPath("/vehicles/GetModelsForMakeYear/make/Honda/modelyear/2015/")).toEqual({
      ok: true,
      canonicalPath: "/vehicles/getmodelsformakeyear/make/honda/modelyear/2015",
    });
    expect(allowVehiclesPath("/vehicles/DecodeVinValuesExtended/1HGCM82633A004352")).toEqual({
      ok: true,
      canonicalPath: "/vehicles/decodevinvaluesextended/1hgcm82633a004352",
    });
  });

  it("rejects unknown endpoints, extra segments, dot segments, and overlong segments", () => {
    expect(allowVehiclesPath("/vehicles/NotAnEndpoint").ok).toBe(false);
    expect(allowVehiclesPath("/vehicles/GetAllMakes/extra").ok).toBe(false);
    expect(allowVehiclesPath("/vehicles/GetAllMakes/..").ok).toBe(false);
    expect(allowVehiclesPath(`/vehicles/${"a".repeat(81)}`).ok).toBe(false);
    expect(allowVehiclesPath("/vehicles/GetModelsForMakeYear/make/honda/nope/1").ok).toBe(false);
  });

  it("keeps the recalls API's canonical spelling and rejects anything else", () => {
    expect(allowRecallsPath("/recalls/RECALLSBYVEHICLE")).toEqual({
      ok: true,
      canonicalPath: "/recalls/recallsByVehicle",
    });
    expect(allowRecallsPath("/recalls/recallsByVin/1hgcm82633a004352")).toEqual({
      ok: true,
      canonicalPath: "/recalls/recallsByVin/1HGCM82633A004352",
    });
    expect(allowRecallsPath("/recalls/notARealEndpoint").ok).toBe(false);
    expect(allowRecallsPath("/recalls/recallsByVehicle/extra").ok).toBe(false);
  });

  it("encodes spaces in a variable name", () => {
    const allowed = allowVehiclesPath("/vehicles/GetVehicleVariableValuesList/battery type");
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(encodeUpstreamPath(allowed.canonicalPath)).toBe("/vehicles/getvehiclevariablevalueslist/battery%20type");
  });
});