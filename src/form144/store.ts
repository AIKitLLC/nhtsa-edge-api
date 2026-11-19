/**
 * SEC Form 144 insider sale notices, served from static assets built by
 * scripts/form144/build-assets.ts out of data/form144 (ingested from SEC EDGAR
 * by scripts/form144/ingest.ts). One file per filing day, so a request reads
 * only the days it asks about.
 */

/** One proposed sale from a filing's securitiesInformation block. Nulls are values EDGAR did not provide. */
export interface Form144Security {
  readonly security_title: string | null;
  readonly shares_to_sell: number | null;
  readonly market_value: number | null;
  readonly shares_outstanding: number | null;
  /** ISO date (YYYY-MM-DD). */
  readonly approximate_sale_date: string | null;
  readonly exchange: string | null;
  readonly broker: string | null;
}

/**
 * One Form 144 notice. Field names follow the Financial Datasets sale-notices
 * shape where EDGAR provides the same fact; see docs/FORM144.md for the mapping.
 */
export interface SaleNotice {
  /** From SEC's company_tickers.json by issuer CIK; null when the issuer has no listed ticker. */
  readonly ticker: string | null;
  /** Issuer CIK, without leading zeros. */
  readonly cik: string;
  readonly issuer: string;
  /** Name of the person for whose account the securities are to be sold. */
  readonly name: string;
  readonly relationships: readonly string[];
  readonly form_type: string;
  /** ISO date the notice was filed, from the EDGAR daily index. */
  readonly filing_date: string;
  /** ISO date signed on the notice; null when absent. */
  readonly notice_date: string | null;
  readonly accession_number: string;
  /** Amendments (144/A) name the filing they replace; null otherwise. */
  readonly replaces_accession_number: string | null;
  readonly plan_adoption_dates: readonly string[];
  readonly securities: readonly Form144Security[];
}

export interface Form144Day {
  readonly date: string;
  /** Unique 144/144-A accession numbers in that day's EDGAR index. */
  readonly indexCount: number;
  /** Accessions whose submission carried no parseable XML block. */
  readonly failed: readonly string[];
  readonly notices: readonly SaleNotice[];
}

export interface Form144Manifest {
  readonly source: string;
  readonly generatedAt: string;
  readonly coverage: { readonly from: string; readonly to: string };
  readonly totalRecords: number;
  readonly days: readonly { readonly date: string; readonly count: number; readonly indexCount: number; readonly failed: number }[];
}

export const FORM144_MANIFEST_PATH = "form144/manifest.json";

export const form144DayPath = (date: string): string => `form144/days/${date}.json`;

/** The part of the ASSETS binding used here, so scripts can import this file without Workers types. */
interface AssetFetcher {
  fetch(request: Request): Promise<Response>;
}

async function getJson<T>(assets: AssetFetcher, path: string): Promise<T | null> {
  const res = await assets.fetch(new Request(`https://assets.invalid/${path}`));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Form 144 asset read failed: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const getForm144Manifest = (assets: AssetFetcher): Promise<Form144Manifest | null> =>
  getJson<Form144Manifest>(assets, FORM144_MANIFEST_PATH);

export const getForm144Day = (assets: AssetFetcher, date: string): Promise<Form144Day | null> =>
  getJson<Form144Day>(assets, form144DayPath(date));
