/**
 * Cloudflare Worker Environment Bindings and Configuration
 */

export interface Env {
  /**
   * Current deployment environment: development | staging | production
   */
  readonly ENVIRONMENT?: string;

  /**
   * Timeout in milliseconds for upstream requests to NHTSA (default: 5000)
   */
  readonly UPSTREAM_TIMEOUT_MS?: string;

  /**
   * Toggle persistent Cloudflare KV caching: "true" | "false"
   */
  readonly ENABLE_KV_CACHE?: string;

  /**
   * Optional Cloudflare KV Namespace for global persistent cache
   */
  readonly NHTSA_CACHE_KV?: KVNamespace;

  /**
   * Workers Rate Limiting binding (see wrangler.jsonc "ratelimits"); absent in tests and local dev.
   */
  readonly RATE_LIMITER?: RateLimit;

  /**
   * Static assets built from data/vpic (scripts/vpic/build-assets.ts): the offline decoder's data.
   */
  readonly ASSETS: Fetcher;

  /**
   * Official api.data.gov API Key for elevated rate limits (10,000+ req/hr)
   */
  readonly DATA_GOV_API_KEY?: string;

  /**
   * Have I Been Pwned API key (secret) for POST /api/v1/leak/email; the route answers 503 without it.
   */
  readonly HIBP_API_KEY?: string;

  /**
   * Bearer token clients must send to POST /api/v1/leak/email (secret); the route answers 503 without it.
   */
  readonly LEAK_API_TOKEN?: string;

  /**
   * Stricter per-client limit for email lookups, which spend the paid HIBP quota.
   */
  readonly LEAK_RATE_LIMITER?: RateLimit;
}

export type AppVariables = {
  requestId: string;
  startTime: number;
};
