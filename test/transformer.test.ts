import { describe, it, expect } from "vitest";
import {
  cleanEmptyFields,
  parseSafeInt,
  parseSafeFloat,
  transformVinDecode,
  transformVariableArray,
} from "../src/services/transformer";
import type { RawVinValuesResult, VpicRawResponse, VpicVariableItem } from "../src/types/nhtsa";

describe("Transformer Service", () => {
  describe("cleanEmptyFields", () => {
    it("should remove empty strings, null, undefined, and Not Applicable", () => {
      const input = {
        make: "Toyota",
        model: "Camry",
        trim: "",
        notes: null,
        turbo: "Not Applicable",
        other: undefined,
        year: 2022,
      };

      const cleaned = cleanEmptyFields(input);
      expect(cleaned).toEqual({
        make: "Toyota",
        model: "Camry",
        year: 2022,
      });
    });
  });

  describe("parseSafeInt and parseSafeFloat", () => {
    it("should parse valid integers and floats, returning null for invalid or empty inputs", () => {
      expect(parseSafeInt("4")).toBe(4);
      expect(parseSafeInt("")).toBeNull();
      expect(parseSafeInt(undefined)).toBeNull();
      expect(parseSafeInt("abc")).toBeNull();

      expect(parseSafeFloat("3.5")).toBe(3.5);
      expect(parseSafeFloat("")).toBeNull();
      expect(parseSafeFloat("xyz")).toBeNull();
    });
  });

  describe("transformVinDecode", () => {
    it("should transform raw VPIC results into a clean, typed CompactVehicleSpec", () => {
      const mockRaw: VpicRawResponse<RawVinValuesResult> = {
        Count: 1,
        Message: "Results returned successfully.",
        SearchCriteria: "VIN(s): 5UXWX7C5*BA",
        Results: [
          {
            VIN: "5UXWX7C5*BA",
            Make: "BMW",
            Model: "X3",
            ModelYear: "2011",
            Trim: "xDrive35i",
            Series: "",
            VehicleType: "MULTIPURPOSE PASSENGER VEHICLE (MPV)",
            BodyClass: "Sport Utility Vehicle [SUV]/Multipurpose Vehicle [MPV]",
            Doors: "4",
            DriveType: "AWD/All-Wheel Drive",
            EngineCylinders: "6",
            DisplacementL: "3.0",
            EngineHP: "300",
            FuelTypePrimary: "Gasoline",
            ElectrificationLevel: "",
            PlantCity: "MUNICH",
            PlantCountry: "GERMANY",
            Manufacturer: "BMW NORTH AMERICA",
            ErrorCode: "0",
            ErrorText: "0 - VIN decoded clean",
            ABS: "",
            TPMS: "Direct",
            SeatBeltsAll: "Manual",
            BatteryA: "",
          },
        ],
      };

      const result = transformVinDecode(mockRaw);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.vin).toBe("5UXWX7C5*BA");
      expect(result.make).toBe("BMW");
      expect(result.model).toBe("X3");
      expect(result.year).toBe(2011);
      expect(result.doors).toBe(4);
      expect(result.engineCylinders).toBe(6);
      expect(result.displacementL).toBe(3.0);
      expect(result.engineHp).toBe(300);
      expect(result.isValidVin).toBe(true);
      expect(result.errorCode).toBe("0");

      // Verify empty fields were stripped from extraAttributes
      expect(result.extraAttributes["ABS"]).toBeUndefined();
      expect(result.extraAttributes["BatteryA"]).toBeUndefined();
      // Verify non-empty extra attributes are retained
      expect(result.extraAttributes["TPMS"]).toBe("Direct");
      expect(result.extraAttributes["SeatBeltsAll"]).toBe("Manual");
    });

    it("should return null if Results array is empty", () => {
      const emptyRaw: VpicRawResponse<RawVinValuesResult> = {
        Count: 0,
        Message: "No records",
        Results: [],
      };
      expect(transformVinDecode(emptyRaw)).toBeNull();
    });
  });

  describe("transformVariableArray", () => {
    it("should transform array of variable items into a flat dictionary, filtering out nulls", () => {
      const rawVariables: VpicRawResponse<VpicVariableItem> = {
        Count: 3,
        Message: "Success",
        Results: [
          { Variable: "Make", Value: "HONDA", ValueId: "474", VariableId: 26 },
          { Variable: "Model", Value: "CIVIC", ValueId: "1861", VariableId: 28 },
          { Variable: "Battery Current (Amps)", Value: null, ValueId: null, VariableId: 1 },
          { Variable: "Turbo", Value: "", ValueId: "", VariableId: 135 },
        ],
      };

      const mapped = transformVariableArray(rawVariables);
      expect(mapped).toEqual({
        Make: "HONDA",
        Model: "CIVIC",
      });
    });
  });
});
