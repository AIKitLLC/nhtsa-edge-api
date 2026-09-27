/**
 * Strongly typed NHTSA API responses and domain models
 * Follows Safe High-Performance Doctrine: discriminated types, immutability, zero `any`.
 */

export interface VpicRawResponse<T = Record<string, string | null>> {
  readonly Count: number;
  readonly Message: string;
  readonly SearchCriteria?: string;
  readonly Results: readonly T[];
}

export interface VpicVariableResult {
  readonly Value: string | null;
  readonly ValueId?: string | null;
  readonly Variable: string;
  readonly VariableId: number;
}

export type VpicVariableItem = VpicVariableResult;

export interface RawVinValuesResult {
  readonly VIN?: string | null;
  readonly Make?: string | null;
  readonly MakeID?: string | null;
  readonly Model?: string | null;
  readonly ModelID?: string | null;
  readonly ModelYear?: string | null;
  readonly Series?: string | null;
  readonly Trim?: string | null;
  readonly VehicleType?: string | null;
  readonly BodyClass?: string | null;
  readonly Doors?: string | null;
  readonly DriveType?: string | null;
  readonly EngineCylinders?: string | null;
  readonly DisplacementL?: string | null;
  readonly DisplacementCC?: string | null;
  readonly EngineHP?: string | null;
  readonly FuelTypePrimary?: string | null;
  readonly ElectrificationLevel?: string | null;
  readonly PlantCity?: string | null;
  readonly PlantCountry?: string | null;
  readonly PlantState?: string | null;
  readonly Manufacturer?: string | null;
  readonly ManufacturerId?: string | null;
  readonly ErrorCode?: string | null;
  readonly ErrorText?: string | null;
  readonly [key: string]: string | null | undefined;
}

/**
 * Compact, modern, stripped payload representation of a decoded VIN.
 * Eliminates 100+ empty string fields from standard NHTSA VPIC response.
 */
export interface CompactVehicleSpec {
  readonly vin: string;
  readonly make: string | null;
  readonly model: string | null;
  readonly year: number | null;
  readonly trim: string | null;
  readonly series: string | null;
  readonly vehicleType: string | null;
  readonly bodyClass: string | null;
  readonly doors: number | null;
  readonly driveType: string | null;
  readonly engineCylinders: number | null;
  readonly displacementL: number | null;
  readonly engineHp: number | null;
  readonly fuelType: string | null;
  readonly electrificationLevel: string | null;
  readonly plantCountry: string | null;
  readonly plantCity: string | null;
  readonly manufacturer: string | null;
  readonly isValidVin: boolean;
  readonly errorCode: string | null;
  readonly errorText: string | null;
  /**
   * Only non-empty secondary attributes are retained here as key-value pairs
   */
  readonly extraAttributes: Readonly<Record<string, string>>;
}

export interface NhtsaRecallItem {
  readonly NHTSACampaignNumber?: string;
  readonly Manufacturer?: string;
  readonly Component?: string;
  readonly Summary?: string;
  readonly Conequence?: string;
  readonly Remedy?: string;
  readonly Notes?: string;
  readonly ModelYear?: string;
  readonly Make?: string;
  readonly Model?: string;
  readonly [key: string]: unknown;
}

export interface NhtsaRecallsResponse {
  readonly count: number;
  readonly message: string;
  readonly results: readonly NhtsaRecallItem[];
}

/**
 * Cache status tracking
 */
export type CacheStatus = "HIT" | "MISS" | "STALE" | "BYPASS";

export type CacheTier = "EDGE_CACHE" | "KV" | "UPSTREAM";

/**
 * Discriminated API result
 */
export type ApiResponse<T> =
  | {
      readonly success: true;
      readonly data: T;
      readonly source: CacheTier;
      readonly cached: boolean;
      readonly latencyMs: number;
    }
  | {
      readonly success: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly details?: unknown;
      };
      readonly latencyMs: number;
    };
