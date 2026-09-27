/**
 * NHTSA Live API Synchronizer (Channel 2: Incremental & Self-Healing Sync)
 * Syncs fresh makes, models, and WMIs directly from NHTSA VPIC APIs into Cloudflare D1.
 */

import { CONFIG } from "../config";
import type { Env } from "../types/env";
import { fetchUpstream } from "./upstream";
import type { WmiRecord } from "./d1-database";

export interface SyncResult {
  readonly channel: "LIVE_API";
  readonly type: "MAKES" | "MODELS" | "WMI" | "CATALOG";
  readonly recordsProcessed: number;
  readonly recordsUpdated: number;
  readonly success: boolean;
  readonly message: string;
  readonly timestamp: string;
}

export interface LiveMakeItem {
  readonly Make_ID: number;
  readonly Make_Name: string;
}

export interface LiveModelItem {
  readonly Make_ID: number;
  readonly Make_Name: string;
  readonly Model_ID: number;
  readonly Model_Name: string;
}

export interface LiveWmiItem {
  readonly CommonName?: string;
  readonly Make?: string;
  readonly ManufacturerName?: string;
  readonly VehicleType?: string;
  readonly Country?: string;
}

/**
 * Syncs list of all vehicle makes directly from NHTSA API
 */
export async function syncMakesFromApi(env?: Env): Promise<SyncResult> {
  const url = `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/GetAllMakes?format=json`;
  const res = await fetchUpstream(url);

  if (res.status !== 200) {
    return {
      channel: "LIVE_API",
      type: "MAKES",
      recordsProcessed: 0,
      recordsUpdated: 0,
      success: false,
      message: `NHTSA API returned status ${res.status}`,
      timestamp: new Date().toISOString(),
    };
  }

  let data: { Results?: LiveMakeItem[] };
  try {
    data = JSON.parse(res.bodyText) as { Results?: LiveMakeItem[] };
  } catch {
    return {
      channel: "LIVE_API",
      type: "MAKES",
      recordsProcessed: 0,
      recordsUpdated: 0,
      success: false,
      message: "Failed to parse JSON response from NHTSA API",
      timestamp: new Date().toISOString(),
    };
  }

  const results = data.Results ?? [];
  let updated = 0;

  if (env?.DB && results.length > 0) {
    const db = env.DB;
    try {
      // D1 batches are chunked to stay well within per-batch statement limits
      const chunkSize = 100;
      for (let i = 0; i < results.length; i += chunkSize) {
        const chunk = results.slice(i, i + chunkSize);
        const stmts = chunk.map((m) =>
          db
            .prepare(
              `INSERT INTO makes (make, make_id) VALUES (?, ?)
               ON CONFLICT(make) DO UPDATE SET make_id = excluded.make_id, updated_at = CURRENT_TIMESTAMP`
            )
            .bind(m.Make_Name.toUpperCase().trim(), m.Make_ID)
        );
        await db.batch(stmts);
        updated += chunk.length;
      }

      await recordSyncHistory(db, "MAKES", results.length, updated, "SUCCESS", `Synced ${updated} makes from API`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await recordSyncHistory(db, "MAKES", results.length, updated, "FAILED", message);
      return {
        channel: "LIVE_API",
        type: "MAKES",
        recordsProcessed: results.length,
        recordsUpdated: updated,
        success: false,
        message: `D1 write failed after ${updated} makes: ${message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  return {
    channel: "LIVE_API",
    type: "MAKES",
    recordsProcessed: results.length,
    recordsUpdated: updated,
    success: true,
    message: `Successfully processed ${results.length} makes from NHTSA API.`,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Appends a row to sync_history; failures here must never break a sync.
 */
async function recordSyncHistory(
  db: D1Database,
  syncType: SyncResult["type"],
  processed: number,
  updated: number,
  status: "SUCCESS" | "FAILED",
  details: string
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO sync_history (sync_channel, sync_type, records_processed, records_updated, status, details)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind("LIVE_API", syncType, processed, updated, status, details)
      .run();
  } catch {
    // History is best-effort
  }
}

/**
 * Syncs models for a specific make from NHTSA API into D1
 */
export async function syncModelsForMakeFromApi(
  make: string,
  env?: Env
): Promise<{ success: boolean; make: string; models: string[]; updatedCount: number }> {
  const url = `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/GetModelsForMake/${encodeURIComponent(
    make
  )}?format=json`;
  const res = await fetchUpstream(url);

  if (res.status !== 200) {
    return { success: false, make, models: [], updatedCount: 0 };
  }

  let data: { Results?: LiveModelItem[] };
  try {
    data = JSON.parse(res.bodyText) as { Results?: LiveModelItem[] };
  } catch {
    return { success: false, make, models: [], updatedCount: 0 };
  }

  const results = data.Results ?? [];
  const uniqueNames = new Set<string>();
  for (const item of results) {
    if (typeof item.Model_Name === "string" && item.Model_Name.trim() !== "") {
      uniqueNames.add(item.Model_Name.trim());
    }
  }
  const modelNames = [...uniqueNames];

  let updatedCount = 0;
  if (env?.DB && modelNames.length > 0) {
    const db = env.DB;
    const cleanMake = make.toUpperCase().trim();
    try {
      const stmts = modelNames.map((model) =>
        db
          .prepare(
            `INSERT INTO makes_models (make, model) VALUES (?, ?)
             ON CONFLICT(make, model) DO NOTHING`
          )
          .bind(cleanMake, model)
      );

      const chunkSize = 100;
      for (let i = 0; i < stmts.length; i += chunkSize) {
        await db.batch(stmts.slice(i, i + chunkSize));
      }
      updatedCount = modelNames.length;
      await recordSyncHistory(db, "MODELS", modelNames.length, updatedCount, "SUCCESS", `Synced models for ${cleanMake}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await recordSyncHistory(db, "MODELS", modelNames.length, updatedCount, "FAILED", `${cleanMake}: ${message}`);
      return { success: false, make: cleanMake, models: modelNames, updatedCount };
    }
  }

  return {
    success: true,
    make: make.toUpperCase(),
    models: modelNames,
    updatedCount,
  };
}

/**
 * On-demand WMI sync: fetches live WMI details from NHTSA DecodeWMI and saves to D1
 */
export async function syncWmiFromApi(
  wmi: string,
  env?: Env
): Promise<WmiRecord | null> {
  const cleanWmi = wmi.toUpperCase().trim();
  const url = `${CONFIG.UPSTREAM.VPIC_BASE_URL}/vehicles/DecodeWMI/${encodeURIComponent(
    cleanWmi
  )}?format=json`;

  const res = await fetchUpstream(url);
  if (res.status !== 200) return null;

  let data: { Results?: LiveWmiItem[] };
  try {
    data = JSON.parse(res.bodyText) as { Results?: LiveWmiItem[] };
  } catch {
    return null;
  }

  const first = data.Results?.[0];
  if (!first) return null;

  const record: WmiRecord = {
    wmi: cleanWmi,
    make: (first.Make || first.CommonName || "UNKNOWN").toUpperCase().trim(),
    manufacturer: first.ManufacturerName || first.Make || "UNKNOWN",
    vehicle_type: first.VehicleType || null,
    country: first.Country || null,
  };

  // Upsert into D1 if available
  if (env?.DB) {
    try {
      await env.DB.prepare(
        `INSERT INTO wmi_catalog (wmi, make, manufacturer, vehicle_type, country)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(wmi) DO UPDATE SET
           make = excluded.make,
           manufacturer = excluded.manufacturer,
           vehicle_type = excluded.vehicle_type,
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(
          record.wmi,
          record.make,
          record.manufacturer,
          record.vehicle_type,
          record.country
        )
        .run();
    } catch {
      // D1 write error
    }
  }

  return record;
}

/**
 * Automated Incremental Catalog Sync (can be run via Cloudflare Cron Trigger or CLI)
 */
export async function runIncrementalSync(
  env?: Env,
  topMakes: string[] = [
    "TOYOTA",
    "HONDA",
    "FORD",
    "CHEVROLET",
    "TESLA",
    "BMW",
    "MERCEDES-BENZ",
    "HYUNDAI",
    "KIA",
    "NISSAN",
    "AUDI",
    "VOLKSWAGEN",
    "PORSCHE",
    "MAZDA",
    "SUBARU",
    "LEXUS",
    "JEEP",
  ]
): Promise<{ totalMakesProcessed: number; totalModelsSynced: number; timestamp: string }> {
  let totalModelsSynced = 0;

  for (const make of topMakes) {
    try {
      const res = await syncModelsForMakeFromApi(make, env);
      if (res.success) {
        totalModelsSynced += res.models.length;
      }
    } catch {
      // Skip make on failure and continue
    }
  }

  return {
    totalMakesProcessed: topMakes.length,
    totalModelsSynced,
    timestamp: new Date().toISOString(),
  };
}
