/**
 * Upstream NHTSA API envelope and cache metadata types.
 */

export interface VpicRawResponse<T = Record<string, string | null>> {
  readonly Count: number;
  readonly Message: string;
  readonly SearchCriteria?: string;
  readonly Results: readonly T[];
}

export type CacheStatus = "HIT" | "MISS" | "STALE" | "BYPASS";

export type CacheTier = "EDGE_CACHE" | "KV" | "UPSTREAM";
