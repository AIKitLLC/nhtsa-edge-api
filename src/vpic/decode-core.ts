/**
 * Port of vpic.spvindecode_core (docs/vpic-reference/decode-functions.sql):
 * one decoding pass of a VIN for one candidate model year.
 * Comments name the step of the source each block reproduces.
 */

import { spVinDecodeErrorCode } from "./decode-errors";
import { applyConversions } from "./conversions";
import { buildVarKeys, formulaKeysMatch, formulaValue, patternKeysMatch, toFormulaKeys } from "./keys";
import { ItemList, compareRank, elementMap, nullsFirstDesc, pgInt } from "./items";
import type { CoreAsset, DecodingItem, SchemaRecord, SpecSchema, WmiRecord } from "./types";
import { vehicleSpecCandidates } from "./vehicle-spec";
import { isCarMpvLightTruck, vinCheckDigit2, vinDescriptor, vinWmi } from "./vin-functions";

/** Elements the Pattern query skips (they come from the WMI or the model year). */
const WMI_LEVEL_ELEMENTS = new Set([26, 27, 29, 39]);
/** Elements exempt from "one value per element" ranking. */
const MULTI_VALUE_ELEMENTS = new Set([121, 129, 150, 154, 155, 114, 169, 186]);
const OFF_ROAD_BODY_CLASSES = new Set(["69", "84", "86", "88", "97", "105", "113", "124", "126", "127"]);
const INCOMPLETE_BODY_CLASSES = new Set(["65", "107", "70", "74", "63", "72", "112", "62", "64", "76", "78", "71", "77", "67", "116", "75"]);

const OFF_ROAD_NOTE = " NOTE: Disregard if this is an off-road vehicle PIN, as check digit calculation may not be accurate.";
const CHECK_DIGIT_EXCLUSION_NOTE =
  " NOTE: Check Digit Exception - The check digit was given an exception based on data from the OEM indicating an error on production.";

export interface CorePassInput {
  readonly pass: number;
  readonly modelYear: number | null;
  readonly vin: string;
  readonly modelYearSource: string;
  readonly conclusive: boolean;
  readonly error12: boolean;
}

export interface CoreContext {
  readonly core: CoreAsset;
  readonly wmi: WmiRecord | null;
  readonly schemas: ReadonlyMap<number, SchemaRecord>;
  readonly loadModelMakes: (schemaId: number, modelId: number) => Promise<readonly (readonly [number, string])[]>;
  readonly loadSpecSchemas: (makeIds: readonly number[]) => Promise<readonly SpecSchema[]>;
  /** "YYYY-MM-DD HH:MM:SS.mmm" of NOW(), for PublicAvailabilityDate checks. */
  readonly nowTimestamp: string;
}

export interface CorePassResult {
  readonly items: DecodingItem[];
  readonly returnCode: string;
}

function yearMatches(modelYear: number | null, yearFrom: number, yearTo: number | null): boolean {
  return modelYear === null || (modelYear >= yearFrom && modelYear <= (yearTo ?? 2999));
}

/** PostgreSQL text concatenation: any NULL operand makes the result NULL. */
function concatNull(...parts: (string | null)[]): string | null {
  return parts.some((p) => p === null) ? null : parts.join("");
}

function appendInfo(info: string | null, text: string | null): string | null {
  const combined = concatNull(info ?? "", text);
  return combined === null ? null : combined.trim().substring(0, 500);
}

export async function spvindecodeCore(input: CorePassInput, ctx: CoreContext): Promise<CorePassResult> {
  const { pass, modelYear, vin, modelYearSource } = input;
  const { core, wmi } = ctx;
  const varWmi = vinWmi(vin);
  const descriptor = vinDescriptor(vin);
  const list = new ItemList(pass);
  const elements = elementMap(core);
  const varKeys = buildVarKeys(vin);

  let returnCode = "";
  let correctedVin: string | null = null;
  let errorBytes: string | null = null;
  let unusedPositions: string | null = null;
  let additionalInfo: string | null = null;

  const isPublic = (w: WmiRecord | null): boolean =>
    w !== null && w.publicAvailabilityDate !== null && w.publicAvailabilityDate <= ctx.nowTimestamp;

  const wmiId = wmi && wmi.wmi === varWmi && isPublic(wmi) ? wmi.id : null;

  if (wmiId === null || !wmi) {
    returnCode += " 7 ";
    correctedVin = "";
    errorBytes = "";
  } else {
    // Pattern items (priority = Wmi_VinSchema.YearFrom), ORDER BY P.Id
    const collected: Array<{ row: SchemaRecord["patterns"][number]; schema: SchemaRecord; yearFrom: number }> = [];
    for (const [schemaId, yearFrom, yearTo] of wmi.schemas) {
      if (!yearMatches(modelYear, yearFrom, yearTo)) continue;
      const schema = ctx.schemas.get(schemaId);
      if (!schema || schema.toBeQCed) continue;
      for (const row of schema.patterns) {
        const [, keys, elementId] = row;
        if (WMI_LEVEL_ELEMENTS.has(elementId)) continue;
        const element = elements.get(elementId);
        if (!element || element.decode === null || element.isPrivate) continue;
        if (!patternKeysMatch(varKeys, keys)) continue;
        collected.push({ row, schema, yearFrom });
      }
    }
    collected.sort((a, b) => a.row[0] - b.row[0]);
    for (const { row, schema, yearFrom } of collected) {
      const [id, keys, elementId, attributeId, resolved, changedOn] = row;
      list.add({
        createdOn: changedOn,
        patternId: id,
        keys: keys.toUpperCase(),
        vinSchemaId: schema.id,
        wmiId: wmi.id,
        elementId,
        attributeId,
        value: "XXX",
        source: "Pattern",
        priority: yearFrom,
        toBeQCed: schema.toBeQCed,
        resolved,
      });
    }

    // Engine Model -> EngineModelPattern items
    const engineItem = list
      .forElement(18)
      .sort((a, b) => b.priority - a.priority || nullsFirstDesc(a.createdOn, b.createdOn) || b.seq - a.seq)[0];
    if (engineItem && engineItem.attributeId !== null) {
      for (const p of core.engineModels[engineItem.attributeId.trim().toLowerCase()] ?? []) {
        list.add({
          createdOn: p.changedOn,
          patternId: engineItem.patternId,
          keys: engineItem.keys,
          vinSchemaId: engineItem.vinSchemaId,
          wmiId: wmi.id,
          elementId: p.elementId,
          attributeId: p.attributeId,
          value: "XXX",
          source: "EngineModelPattern",
          priority: 50,
          toBeQCed: null,
          resolved: p.resolved,
        });
      }
    }

    // Vehicle type (from the WMI)
    if (wmi.vehicleTypeId !== null && wmi.vehicleTypeName !== null) {
      list.add({
        createdOn: wmi.changedOn,
        patternId: null,
        keys: varWmi.toUpperCase(),
        vinSchemaId: null,
        wmiId: wmi.id,
        elementId: 39,
        attributeId: String(wmi.vehicleTypeId),
        value: wmi.vehicleTypeName.toUpperCase(),
        source: "VehType",
        priority: 100,
        toBeQCed: null,
        resolved: null,
      });
    }

    // Manufacturer name and id (inserted even when the manufacturer is missing)
    const mfrId = wmi.manufacturerName !== null ? wmi.manufacturerId : null;
    const mfrName = wmi.manufacturerName !== null ? wmi.manufacturerName.toUpperCase() : null;
    const mfrIdText = mfrId === null ? null : String(mfrId);
    list.add({ createdOn: null, patternId: null, keys: varWmi.toUpperCase(), vinSchemaId: null, wmiId, elementId: 27, attributeId: mfrIdText, value: mfrName, source: "Manu. Name", priority: 100, toBeQCed: null, resolved: null });
    list.add({ createdOn: null, patternId: null, keys: varWmi.toUpperCase(), vinSchemaId: null, wmiId, elementId: 157, attributeId: mfrIdText, value: mfrIdText, source: "Manu. Id", priority: 100, toBeQCed: null, resolved: null });

    // Model year
    if (modelYear !== null) {
      list.add({ createdOn: null, patternId: null, keys: modelYearSource, vinSchemaId: null, wmiId: null, elementId: 29, attributeId: String(modelYear), value: String(modelYear), source: "ModelYear", priority: 100, toBeQCed: null, resolved: null });
    }

    // Formula patterns (digits of var_keys as '#'); no element/visibility filters in the source
    const formulaKeys = toFormulaKeys(varKeys);
    const schemaIds = new Set(wmi.schemas.filter(([, from, to]) => yearMatches(modelYear, from, to)).map(([id]) => id));
    const formulas: Array<{ row: SchemaRecord["patterns"][number]; schemaId: number }> = [];
    for (const schemaId of schemaIds) {
      for (const row of ctx.schemas.get(schemaId)?.patterns ?? []) {
        const [, keys, elementId] = row;
        if (!keys.includes("#") || WMI_LEVEL_ELEMENTS.has(elementId)) continue;
        if (formulaKeysMatch(formulaKeys, keys)) formulas.push({ row, schemaId });
      }
    }
    formulas.sort((a, b) => a.row[0] - b.row[0]);
    for (const { row, schemaId } of formulas) {
      const [id, keys, elementId, attributeId, , changedOn] = row;
      list.add({
        createdOn: changedOn,
        patternId: id,
        keys,
        vinSchemaId: schemaId,
        wmiId: null,
        elementId,
        attributeId,
        value: formulaValue(varKeys, keys),
        source: "Formula Pattern",
        priority: 100,
        toBeQCed: null,
        resolved: null,
      });
    }

    // RANK() per element; keep rank 1 (multi-value elements excepted)
    const byElement = new Map<number, DecodingItem[]>();
    for (const item of list.items) {
      if (MULTI_VALUE_ELEMENTS.has(item.elementId)) continue;
      let group = byElement.get(item.elementId);
      if (!group) byElement.set(item.elementId, (group = []));
      group.push(item);
    }
    const losers = new Set<number>();
    for (const group of byElement.values()) {
      const sorted = [...group].sort(compareRank);
      for (const item of sorted.slice(1)) losers.add(item.seq);
    }
    list.removeWhere((item) => losers.has(item.seq));

    // Make: from the model (Make_Model), else the WMI's only make
    const modelItem = list.forElement(28)[0];
    const modelId = pgInt(modelItem?.attributeId ?? null);
    if (modelItem && modelId !== null) {
      const makes = modelItem.vinSchemaId !== null ? await ctx.loadModelMakes(modelItem.vinSchemaId, modelId) : [];
      for (const [makeId, makeName] of makes) {
        list.add({ createdOn: null, patternId: modelItem.patternId, keys: modelItem.keys, vinSchemaId: modelItem.vinSchemaId, wmiId: null, elementId: 26, attributeId: String(makeId), value: makeName.toUpperCase(), source: "pattern - model", priority: 1000, toBeQCed: null, resolved: null });
      }
    } else if (wmi.makes.length === 1) {
      const [makeId, makeName] = wmi.makes[0] ?? [0, ""];
      list.add({ createdOn: wmi.changedOn, patternId: null, keys: varWmi, vinSchemaId: null, wmiId: wmi.id, elementId: 26, attributeId: String(makeId), value: makeName.toUpperCase(), source: "Make", priority: -100, toBeQCed: null, resolved: null });
    }

    // Unit conversions (vpic.Conversion)
    applyConversions(list, core.conversions);

    // Vehicle specs
    const vehTypeItem = list.forElement(39)[0];
    const vehicleTypeId = pgInt(vehTypeItem?.attributeId ?? null);
    const specSchemas = modelId !== null ? await ctx.loadSpecSchemas(wmi.makes.map(([id]) => id)) : [];
    const specs = vehicleSpecCandidates(specSchemas, wmi, vehicleTypeId, modelId, modelYear, list.items);
    for (const s of specs) {
      list.add({ createdOn: s.changedOn, patternId: s.groupId, keys: "", vinSchemaId: s.schemaId, wmiId: null, elementId: s.elementId, attributeId: s.attributeId, value: "XXX", source: "Vehicle Specs", priority: -100, toBeQCed: s.toBeQCed, resolved: s.resolved });
    }

    if (!list.items.some((d) => d.patternId !== null)) {
      returnCode += " 8 ";
      correctedVin = "";
      errorBytes = "";
    } else {
      const err = spVinDecodeErrorCode(vin, modelYear, wmi, list.items);
      returnCode = err.returnCode;
      correctedVin = err.correctedVin;
      errorBytes = err.errorBytes;
      unusedPositions = err.unusedPositions;
    }
  }

  // Glider / off-road warnings from the body class
  const bodyClass = list.forElement(5).map((d) => d.attributeId);
  if (bodyClass.includes("64")) returnCode += " 9 ";
  let isOffRoad = false;
  if (bodyClass.some((a) => a !== null && OFF_ROAD_BODY_CLASSES.has(a))) {
    returnCode += " 10 ";
    isOffRoad = true;
  }

  if (modelYear === null) returnCode += " 11 ";

  const vehicleType = list.forElement(39)[0]?.attributeId ?? null;
  const isVinExceptionCheckDigit = wmi !== null && wmi.wmi === varWmi && wmi.checkDigitExceptions.includes(vin);

  // Valid characters per position
  let startPos = 13;
  let isCarMpvLt = false;
  if (vin.charAt(2) === "9") {
    startPos = 15;
  } else if (isCarMpvLightTruck(wmi && wmi.wmi === varWmi ? wmi : null)) {
    startPos = 13;
    isCarMpvLt = true;
  } else {
    startPos = 14;
  }

  let invalidChars = "";
  for (let j = 1; j <= vin.length; j++) {
    if (j === 9 && (isOffRoad || isVinExceptionCheckDigit)) continue;
    let chr = vin.charAt(j - 1);
    const bad =
      (j !== 9 && j < startPos && !/^[0-9ABCDEFGHJKLMNPRSTUVWXYZ*]$/.test(chr)) ||
      (j !== 9 && j >= startPos && !/^[0-9*]$/.test(chr)) ||
      (j === 9 && !/^[0-9X*]$/.test(chr)) ||
      (j === 10 && !/^[1-9ABCDEFGHJKLMNPRSTVWXY]$/.test(chr));
    if (bad) {
      if (chr === "") chr = "_";
      if (correctedVin === "") correctedVin = vin;
      invalidChars += `, ${j}:${chr}`;
      if (correctedVin !== null) {
        correctedVin = correctedVin.substring(0, j - 1) + "!" + correctedVin.substring(j, j + 100);
      }
    }
  }
  if (invalidChars !== "") returnCode += " 400 ";
  if (input.error12) returnCode += " 12 ";

  // Default values for the vehicle type
  const vehicleTypeId = pgInt(vehicleType);
  if (vehicleTypeId !== null) {
    const present = new Set(list.items.map((d) => d.elementId));
    const seen = new Set<string>();
    for (const dv of core.defaults) {
      if (dv.vehicleTypeId !== vehicleTypeId || present.has(dv.elementId)) continue;
      const element = elements.get(dv.elementId);
      if (!element) continue;
      const value = element.dataType === "lookup" && dv.defaultValue === "0" ? "Not Applicable" : "XXX";
      const key = `${dv.changedOn}|${dv.elementId}|${dv.defaultValue}|${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.add({ createdOn: dv.changedOn, patternId: null, keys: null, vinSchemaId: null, wmiId: null, elementId: dv.elementId, attributeId: dv.defaultValue, value, source: "Default", priority: 10, toBeQCed: null, resolved: dv.resolved });
    }
  }

  // Length / check digit
  if (vin.length < 17) {
    returnCode += " 6 ";
  } else if (vin.charAt(8) !== vinCheckDigit2(vin, isCarMpvLt) && !isVinExceptionCheckDigit) {
    returnCode += " 1 ";
  }

  const errors = returnCode.split(" 9 ").join("").split(" 10 ").join("").split(" 12 ").join("").trim();
  if (errors === "" || errors === "14") returnCode = ` 0 ${returnCode}`;

  if (returnCode.includes(" 0 ") && list.forElement(28).length === 0) returnCode += " 14 ";

  const errorCodeText = (id: number): string => core.errorCodes.find((e) => e.id === id)?.additionalErrorText ?? "";
  if (returnCode.includes(" 4 ")) additionalInfo = errorCodeText(4);
  if (returnCode.includes(" 5 ")) additionalInfo = errorCodeText(5);
  if (returnCode.includes(" 14 ")) {
    additionalInfo = appendInfo(additionalInfo, concatNull(" Unused position(s): ", unusedPositions, ". "));
  }
  if (returnCode.includes(" 400 ")) {
    additionalInfo = appendInfo(additionalInfo, ` Invalid character(s): ${invalidChars.substring(2)}. `);
  }
  const bodyClassNow = list.forElement(5).map((d) => d.attributeId);
  if (vehicleType === "10" || bodyClassNow.some((a) => a !== null && INCOMPLETE_BODY_CLASSES.has(a))) {
    additionalInfo = appendInfo(
      additionalInfo,
      " Incomplete Vehicle Warning - Please be advised that the vehicle may have been altered and may not be an accurate representation of the vehicle in its current condition. "
    );
  }
  if (!input.conclusive) {
    additionalInfo = appendInfo(
      additionalInfo,
      " The Model Year decoded for this VIN may be incorrect. If you know the Model year, please enter it and decode again to get more accurate information. "
    );
  }

  const codes = [...core.errorCodes]
    .filter((e) => returnCode.includes(` ${e.id} `))
    .sort((a, b) => a.id - b.id);
  const errorMessages =
    codes.length > 0
      ? codes
          .map((e) => {
            const note = isOffRoad && e.id === 1 ? OFF_ROAD_NOTE : isVinExceptionCheckDigit && e.id === 0 ? CHECK_DIGIT_EXCLUSION_NOTE : "";
            return `${e.name}${note}`.trim();
          })
          .join("; ")
          .substring(0, 500)
      : null;
  const errorCodes = codes.length > 0 ? codes.map((e) => String(e.id)).join(",") : null;

  // 'Corrections' rows (UNION removes exact duplicates; element ids differ, so none are)
  const corrections: Array<[number, string | null]> = [
    [142, correctedVin],
    [143, errorCodes],
    [191, errorMessages],
    [144, errorBytes],
    [156, additionalInfo],
    [196, descriptor],
  ];
  for (const [elementId, value] of corrections) {
    list.add({ createdOn: null, patternId: null, keys: "", vinSchemaId: null, wmiId: null, elementId, attributeId: value, value, source: "Corrections", priority: 999, toBeQCed: null, resolved: null });
  }

  return { items: list.items, returnCode };
}
