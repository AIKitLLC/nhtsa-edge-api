/**
 * Shared shape of the optional third-party enrichments of /api/v1/vin/:vin/unified.
 * `error` (timeout, HTTP error, bad payload) is kept apart from `no-match` so a
 * transient failure is never cached as if the source had no data.
 */

export type EnrichmentOutcome = "matched" | "no-match" | "error" | "skipped";

export interface EnrichmentResult<T> {
  readonly outcome: EnrichmentOutcome;
  readonly data: T | null;
}

export const ENRICHMENT_TIMEOUT_MS = 3500;
/** Model-level reference data changes rarely; let Cloudflare cache the lookups. */
export const ENRICHMENT_FETCH_CACHE = { cacheTtl: 86400, cacheEverything: true } as const;

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "nhtsa-edge-api (+https://github.com/AIKitLLC/nhtsa-edge-api)" },
    signal: AbortSignal.timeout(ENRICHMENT_TIMEOUT_MS),
    cf: ENRICHMENT_FETCH_CACHE,
  } as RequestInit);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

export const positiveInt = (v: string | undefined): number | undefined => {
  if (v === undefined) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};
