/**
 * Project Configuration, Constants, and Cache TTL policies
 */

export const CONFIG = {
  UPSTREAM: {
    VPIC_BASE_URL: "https://vpic.nhtsa.dot.gov/api",
    RECALLS_BASE_URL: "https://api.nhtsa.gov",
    DATA_GOV_BASE_URL: "https://api.data.gov",
    DEFAULT_TIMEOUT_MS: 5000,
    MAX_RETRIES: 2,
    RETRY_BASE_DELAY_MS: 300,
  },
  CACHE: {
    // VIN specifications never change once manufactured -> 30 days
    VIN_TTL_SECONDS: 30 * 24 * 60 * 60, // 2,592,000s
    // Makes, models and catalogs update very infrequently -> 7 days
    CATALOG_TTL_SECONDS: 7 * 24 * 60 * 60, // 604,800s
    // Safety recalls update periodically -> 6 hours
    RECALLS_TTL_SECONDS: 6 * 60 * 60, // 21,600s
    // Default fallback TTL -> 24 hours
    DEFAULT_TTL_SECONDS: 24 * 60 * 60, // 86,400s
    // Stale-While-Revalidate window: 24 hours
    SWR_TTL_SECONDS: 24 * 60 * 60,
  },
  HEADERS: {
    CACHE_STATUS: "X-Cache-Status",
    CACHE_TIER: "X-Cache-Tier",
    RESPONSE_TIME: "X-Response-Time-Ms",
    UPSTREAM_TIME: "X-Upstream-Time-Ms",
    SERVER_TIMING: "Server-Timing",
    DATA_VERSION: "X-Vpic-Data-Version",
    DECODE_SOURCE: "X-Decode-Source",
    /** Real status of a cached upstream error. The Cache API only stores HTTP 200. */
    CACHED_STATUS: "X-Cached-Status",
  },
} as const;

/** Hosts that may see DATA_GOV_API_KEY. Exact hostname, not a substring and not a subdomain. */
const DATA_GOV_KEY_HOSTS: ReadonlySet<string> = new Set(["api.data.gov", "api.nhtsa.gov"]);

/**
 * Drops every `api_key` query parameter. The data.gov credential is a header, never a URL:
 * URLs land in access logs, caches, and Referer.
 */
export function stripApiKeyQuery(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const secretNames = [...parsed.searchParams.keys()].filter((key) => key.toLowerCase() === "api_key");
  if (secretNames.length === 0) return url;
  for (const key of secretNames) parsed.searchParams.delete(key);
  return parsed.toString();
}

/**
 * `X-Api-Key` only when `url`'s hostname is api.data.gov or api.nhtsa.gov.
 * Any other host, including one that merely contains those names, gets nothing.
 */
export function dataGovKeyHeader(url: string, apiKey: string | undefined): Record<string, string> {
  if (!apiKey) return {};
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return {};
  }
  return DATA_GOV_KEY_HOSTS.has(host) ? { "X-Api-Key": apiKey } : {};
}
