/**
 * EPA/DOE fuel-economy data, served from static assets built by scripts/epa/build-assets.ts.
 * One small file per model year and make, so a request reads a few KB, not the dataset.
 */

/** One EPA vehicle record, with EPA's own column names. Blank values are omitted. */
export type EpaVehicle = Readonly<Record<string, string | number>>;

export interface EpaShard {
  /** Date of the FuelEconomy.gov file this was built from (YYYY-MM-DD). */
  readonly sourceDate: string;
  readonly vehicles: readonly EpaVehicle[];
}

const slug = (make: string): string => make.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const epaShardPath = (year: number | string, make: string): string => `epa/${year}/${slug(make)}.json`;

/** The part of the ASSETS binding used here, so scripts can import this file without Workers types. */
interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

/** Vehicles of a model year and make (make matched ignoring case and punctuation); null when there are none. */
export async function getEpaShard(assets: AssetFetcher, year: number, make: string): Promise<EpaShard | null> {
  if (slug(make) === "") return null;
  const res = await assets.fetch(new Request(`https://assets.invalid/${epaShardPath(year, make)}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`EPA asset read failed: HTTP ${res.status}`);
  return (await res.json()) as EpaShard;
}
