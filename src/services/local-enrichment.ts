import type { Env } from "../types/env";
import { decodeVinLocally, type LocalDecodedVehicle } from "./local-decoder";
import { getVinFromD1, getWmiFromD1 } from "./d1-database";

/**
 * Runs the in-memory decoder, then fills gaps from D1 when it is bound:
 * - a previously decoded VIN (stored from upstream) supplies model/manufacturer/type
 * - otherwise the D1 WMI catalog supplies make/manufacturer for unknown WMIs
 * The response shape is always LocalDecodedVehicle.
 *
 * Parity audits must pass `useStoredVin: false`: stored VINs come from upstream,
 * so comparing them against upstream again would always report 100%.
 */
export async function decodeWithEnrichment(
  vin: string,
  env?: Env,
  options: { readonly useStoredVin: boolean } = { useStoredVin: true }
): Promise<LocalDecodedVehicle> {
  const local = decodeVinLocally(vin);
  const db = env?.DB;
  if (!db) return local;

  const stored = options.useStoredVin ? await getVinFromD1(db, local.vin) : null;
  if (stored) {
    return {
      ...local,
      make: local.make ?? stored.make,
      model: stored.model,
      manufacturer: stored.manufacturer ?? local.manufacturer,
      vehicleType: stored.vehicleType ?? local.vehicleType,
      year: stored.year ?? local.year,
      decodeSource: "LOCAL_D1_DATABASE",
    };
  }

  if (!local.make) {
    const wmiRecord = await getWmiFromD1(db, local.wmi);
    if (wmiRecord) {
      return {
        ...local,
        make: wmiRecord.make,
        manufacturer: wmiRecord.manufacturer,
        vehicleType: wmiRecord.vehicle_type ?? local.vehicleType,
        plantCountry: local.plantCountry ?? wmiRecord.country,
        decodeSource: "LOCAL_D1_DATABASE",
      };
    }
  }

  return local;
}
