/**
 * Project Configuration, Constants, and Cache TTL policies
 */

export const CONFIG = {
  UPSTREAM: {
    VPIC_BASE_URL: "https://vpic.nhtsa.dot.gov/api",
    RECALLS_BASE_URL: "https://api.nhtsa.gov",
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
  },
} as const;
