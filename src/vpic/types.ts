/**
 * Shapes of the pre-built vPIC assets (produced by scripts/vpic/build-assets.ts from
 * data/vpic) and of the in-memory decoding items used by the spVinDecode port.
 *
 * Timestamps are "YYYY-MM-DD HH:MM:SS.mmm" strings (sortable), taken from the dump
 * as COALESCE(updatedon, createdon).
 */

export interface ElementDef {
  readonly id: number;
  readonly name: string;
  readonly code: string | null;
  readonly groupName: string | null;
  readonly dataType: string | null;
  readonly decode: string | null;
  readonly isPrivate: boolean;
  readonly weight: number | null;
}

export interface ErrorCodeDef {
  readonly id: number;
  readonly name: string;
  readonly additionalErrorText: string | null;
  readonly weight: number | null;
}

export interface ConversionDef {
  readonly id: number;
  readonly fromElementId: number;
  readonly toElementId: number;
  readonly formula: string;
}

export interface DefaultValueDef {
  readonly elementId: number;
  readonly vehicleTypeId: number;
  readonly defaultValue: string;
  /** Value after vpic.fElementAttributeValue(elementId, defaultValue). */
  readonly resolved: string | null;
  readonly changedOn: string | null;
}

/** Row of vpic.EngineModelPattern (for one engine model name). */
export interface EngineModelPatternDef {
  readonly elementId: number;
  readonly attributeId: string;
  readonly resolved: string | null;
  readonly changedOn: string | null;
}

export interface CoreAsset {
  readonly dumpVersion: string;
  readonly elements: readonly ElementDef[];
  readonly errorCodes: readonly ErrorCodeDef[];
  readonly conversions: readonly ConversionDef[];
  readonly defaults: readonly DefaultValueDef[];
  /** Keyed by lower(trim(EngineModel.Name)). */
  readonly engineModels: Readonly<Record<string, readonly EngineModelPatternDef[]>>;
  /** vpic.VinDescriptor: descriptor -> model year. */
  readonly vinDescriptors: Readonly<Record<string, number>>;
  /** Asset bucket counts, so the runtime and the build agree on file names. */
  readonly buckets: { readonly wmi: number; readonly schema: number; readonly spec: number; readonly catalog: number };
}

/** vpic.Wmi_VinSchema row: [vinSchemaId, yearFrom, yearTo | null]. */
export type WmiSchemaLink = readonly [number, number, number | null];

export interface WmiRecord {
  readonly id: number;
  readonly wmi: string;
  readonly manufacturerId: number | null;
  readonly manufacturerName: string | null;
  readonly vehicleTypeId: number | null;
  readonly vehicleTypeName: string | null;
  readonly truckTypeId: number | null;
  readonly publicAvailabilityDate: string | null;
  readonly changedOn: string | null;
  /** vpic.Wmi_Make joined to vpic.Make: [makeId, makeName]. */
  readonly makes: readonly (readonly [number, string])[];
  /** Ordered by Wmi_VinSchema.Id. */
  readonly schemas: readonly WmiSchemaLink[];
  /** VINs of this WMI listed in vpic.VinException with CheckDigit = true. */
  readonly checkDigitExceptions: readonly string[];
}

/** Pattern row: [id, keys, elementId, attributeId, resolvedValue, changedOn]. */
export type PatternRow = readonly [number, string, number, string, string | null, string | null];

export interface SchemaRecord {
  readonly id: number;
  readonly toBeQCed: boolean;
  /** Patterns that can take part in decoding (decodable/public or formula keys). */
  readonly patterns: readonly PatternRow[];
  /**
   * Valid characters per key position (index 1-based as in fValidCharsInKey),
   * from all patterns of the schema; used by spVinDecode_ErrorCode.
   */
  readonly validChars: Readonly<Record<string, string>>;
}

export interface SchemaBucket {
  readonly schemas: Readonly<Record<string, SchemaRecord>>;
  /** Model id -> makes of that model (vpic.Make_Model joined to vpic.Make). */
  readonly modelMakes: Readonly<Record<string, readonly (readonly [number, string])[]>>;
}

export interface SpecPatternGroup {
  /** vpic.VSpecSchemaPattern.Id */
  readonly id: number;
  /** Key patterns: [elementId, attributeId]. */
  readonly keys: readonly (readonly [number, string])[];
  /** Non-key patterns: [elementId, attributeId, resolved, changedOn]. */
  readonly values: readonly (readonly [number, string, string | null, string | null])[];
}

export interface SpecSchema {
  readonly id: number;
  readonly makeId: number;
  readonly vehicleTypeId: number | null;
  readonly toBeQCed: boolean;
  readonly modelIds: readonly number[];
  readonly years: readonly number[];
  readonly groups: readonly SpecPatternGroup[];
}

export interface SpecBucket {
  readonly byMake: Readonly<Record<string, readonly SpecSchema[]>>;
}

export type WmiBucket = Readonly<Record<string, WmiRecord>>;

/**
 * One row of the DecodingItems temp table of spvindecode_core
 * (vpic."tblDecodingItem" plus the serial id used as final tie-breaker).
 */
export interface DecodingItem {
  seq: number;
  readonly pass: number;
  readonly createdOn: string | null;
  readonly patternId: number | null;
  readonly keys: string | null;
  readonly vinSchemaId: number | null;
  readonly wmiId: number | null;
  readonly elementId: number;
  readonly attributeId: string | null;
  value: string | null;
  readonly source: string;
  readonly priority: number;
  toBeQCed: boolean | null;
  /** Value to use when `value` is the 'XXX' placeholder (fElementAttributeValue). */
  readonly resolved: string | null;
}
