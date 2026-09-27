import type { CompactVehicleSpec } from "../types/nhtsa";
import type { ParityComparisonReport } from "./comparator";
import { KNOWN_WMI_CATALOG } from "./local-decoder";

export interface WmiRecord {
  readonly wmi: string;
  readonly make: string;
  readonly manufacturer: string;
  readonly vehicle_type: string | null;
  readonly country: string | null;
}

/**
 * Retrieves a cached decoded VIN from Cloudflare D1
 */
export async function getVinFromD1(
  db: D1Database,
  vin: string
): Promise<CompactVehicleSpec | null> {
  try {
    const result = await db
      .prepare("SELECT raw_json FROM vin_records WHERE vin = ?")
      .bind(vin.toUpperCase())
      .first<{ raw_json: string }>();

    if (result?.raw_json) {
      return JSON.parse(result.raw_json) as CompactVehicleSpec;
    }
  } catch {
    // D1 read error
  }
  return null;
}

/**
 * Saves a decoded VIN specification into Cloudflare D1
 */
export async function saveVinToD1(
  db: D1Database,
  spec: CompactVehicleSpec
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO vin_records (
          vin, make, model, year, body_class, drive_type,
          engine_cylinders, displacement_l, fuel_type, plant_country, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(vin) DO UPDATE SET
          raw_json = excluded.raw_json,
          make = excluded.make,
          model = excluded.model,
          year = excluded.year`
      )
      .bind(
        spec.vin.toUpperCase(),
        spec.make,
        spec.model,
        spec.year,
        spec.bodyClass,
        spec.driveType,
        spec.engineCylinders,
        spec.displacementL,
        spec.fuelType,
        spec.plantCountry,
        JSON.stringify(spec)
      )
      .run();
  } catch {
    // D1 write error ignored
  }
}

/**
 * Retrieves WMI information from Cloudflare D1
 */
export async function getWmiFromD1(
  db: D1Database,
  wmi: string
): Promise<WmiRecord | null> {
  try {
    const row = await db
      .prepare(
        "SELECT wmi, make, manufacturer, vehicle_type, country FROM wmi_catalog WHERE wmi = ?"
      )
      .bind(wmi.toUpperCase())
      .first<WmiRecord>();

    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Retrieves model names for a make from Cloudflare D1 (filled by the live API sync)
 */
export async function getModelsFromD1(db: D1Database, make: string): Promise<string[]> {
  try {
    const { results } = await db
      .prepare(
        "SELECT model FROM makes_models WHERE make = ? AND model != 'BASE_MODEL' ORDER BY model"
      )
      .bind(make.toUpperCase())
      .all<{ model: string }>();
    return results.map((row) => row.model);
  } catch {
    return [];
  }
}

/**
 * Logs a parity audit comparison report into Cloudflare D1
 */
export async function logParityAudit(
  db: D1Database,
  report: ParityComparisonReport
): Promise<void> {
  try {
    const discrepancies = report.fieldAudits.filter((a) => !a.match);
    await db
      .prepare(
        `INSERT INTO parity_audit_logs (
          vin, parity_score, local_latency_ms, upstream_latency_ms,
          is_exact_match, discrepancies_json
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        report.vin,
        report.parityScorePercent,
        report.latencyComparison.localEngineMs,
        report.latencyComparison.upstreamNhtsaMs,
        report.isExactMatch ? 1 : 0,
        JSON.stringify(discrepancies)
      )
      .run();
  } catch {
    // Parity logging error ignored
  }
}

/**
 * Seeds initial top manufacturer WMI data into Cloudflare D1
 */
export async function seedInitialD1Data(db: D1Database): Promise<number> {
  let inserted = 0;
  try {
    const statements = Object.entries(KNOWN_WMI_CATALOG).map(([wmi, item]) => {
      return db
        .prepare(
          `INSERT OR IGNORE INTO wmi_catalog (wmi, make, manufacturer, vehicle_type)
           VALUES (?, ?, ?, ?)`
        )
        .bind(wmi, item.make, item.manufacturer, item.vehicleType ?? null);
    });

    if (statements.length > 0) {
      await db.batch(statements);
      inserted = statements.length;
    }
  } catch {
    // Seeding error
  }
  return inserted;
}
