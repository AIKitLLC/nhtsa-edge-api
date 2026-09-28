/**
 * US DOE / EPA FuelEconomy.gov enrichment (https://www.fueleconomy.gov/feg/ws/).
 * Matched by model year + make + model name, so the figures describe the first EPA
 * configuration of that model, not necessarily this exact VIN's trim/powertrain.
 */

import { fetchJson, positiveInt, type EnrichmentResult } from "./types";

const BASE = "https://www.fueleconomy.gov/ws/rest";

export interface EpaEnergySpecs {
  readonly epaVehicleId: string;
  /** EPA menu entries used for the match, e.g. "Model 3 Long Range AWD". */
  readonly epaModel: string;
  readonly epaOption: string;
  readonly isElectricVehicle: boolean;
  readonly electricRangeMiles?: number;
  readonly electricRangeKm?: number;
  readonly combinedMpgOrMpge?: number;
  readonly motorDescription?: string;
  readonly chargeTimeHours240V?: number;
  readonly co2GramsPerMile?: number;
  readonly matchLevel: "model-year";
}

interface MenuItem {
  readonly text: string;
  readonly value: string;
}
type Menu = { menuItem?: MenuItem[] | MenuItem } | null;

const items = (menu: Menu): MenuItem[] =>
  !menu?.menuItem ? [] : Array.isArray(menu.menuItem) ? menu.menuItem : [menu.menuItem];

/** Exact (case-insensitive) model name first, then the shortest EPA name containing it. */
function pickModel(menu: MenuItem[], model: string): MenuItem | undefined {
  const wanted = model.trim().toLowerCase();
  return (
    menu.find((m) => m.text.toLowerCase() === wanted) ??
    menu.filter((m) => m.text.toLowerCase().includes(wanted)).sort((a, b) => a.text.length - b.text.length)[0]
  );
}

export async function fetchEpaEnergySpecs(make: string, model: string, year: number): Promise<EnrichmentResult<EpaEnergySpecs>> {
  try {
    const q = `year=${year}&make=${encodeURIComponent(make.trim())}`;
    const modelItem = pickModel(items(await fetchJson<Menu>(`${BASE}/vehicle/menu/model?${q}`)), model);
    if (!modelItem) return { outcome: "no-match", data: null };

    const options = items(await fetchJson<Menu>(`${BASE}/vehicle/menu/options?${q}&model=${encodeURIComponent(modelItem.value)}`));
    const option = options[0];
    if (!option) return { outcome: "no-match", data: null };

    const v = await fetchJson<Record<string, string>>(`${BASE}/vehicle/${encodeURIComponent(option.value)}`);
    const rangeMiles = positiveInt(v["range"]);
    const charge = v["charge240"] !== undefined ? parseFloat(v["charge240"]) : NaN;
    const co2 = v["co2"] !== undefined ? parseInt(v["co2"], 10) : NaN;

    return {
      outcome: "matched",
      data: {
        epaVehicleId: option.value,
        epaModel: modelItem.text,
        epaOption: option.text,
        isElectricVehicle: v["atvType"] === "EV" || v["fuelType"] === "Electricity",
        electricRangeMiles: rangeMiles,
        electricRangeKm: rangeMiles !== undefined ? Math.round(rangeMiles * 1.60934) : undefined,
        combinedMpgOrMpge: positiveInt(v["comb08"]),
        motorDescription: v["evMotor"] || undefined,
        chargeTimeHours240V: charge > 0 ? charge : undefined,
        co2GramsPerMile: co2 >= 0 ? co2 : undefined,
        matchLevel: "model-year",
      },
    };
  } catch {
    return { outcome: "error", data: null };
  }
}
