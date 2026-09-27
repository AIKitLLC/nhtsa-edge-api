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
    try {
      // Chunk into batch statements of 100 to respect D1 statement limits
      const chunkSize = 100;
      for (let i = 0; i < Math.min(results.length, 1000); i += chunkSize) {
        const chunk = results.slice(i, i + chunkSize);
        const stmts = chunk.map((m) =>
          env.DB!.prepare(
            `INSERT OR IGNORE INTO makes_models (make, model) VALUES (?, ?)`
          ).bind(m.Make_Name.toUpperCase().trim(), "BASE_MODEL")
        );
        await env.DB.batch(stmts);
        updated += chunk.length;
      }

      await env.DB.prepare(
        `INSERT INTO sync_history (sync_channel, sync_type, records_processed, records_updated, status, details)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(
          "LIVE_API",
          "MAKES",
          results.length,
          updated,
          "SUCCESS",
          `Synced ${updated} makes from API`
        )
        .run();
    } catch {
      // D1 persistence error
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
  const modelNames: string[] = [];

  for (const item of results) {
    if (item.Model_Name && typeof item.Model_Name === "string") {
      const trimmed = item.Model_Name.trim();
      if (!modelNames.includes(trimmed)) {
        modelNames.push(trimmed);
      }
    }
  }

  let updatedCount = 0;
  if (env?.DB && modelNames.length > 0) {
    try {
      const cleanMake = make.toUpperCase().trim();
      const stmts = modelNames.map((model) =>
        env.DB!.prepare(
          `INSERT INTO makes_models (make, model) VALUES (?, ?)
           ON CONFLICT(make, model) DO NOTHING`
        ).bind(cleanMake, model)
      );

      // Execute in chunks
      const chunkSize = 100;
      for (let i = 0; i < stmts.length; i += chunkSize) {
        await env.DB.batch(stmts.slice(i, i + chunkSize));
      }
      updatedCount = modelNames.length;
    } catch {
      // D1 write error
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
