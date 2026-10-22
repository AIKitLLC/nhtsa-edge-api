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
   * Workers Rate Limiting binding (see wrangler.jsonc "ratelimits").
   * A missing binding fails closed (HTTP 503) unless ALLOW_NO_RATE_LIMIT is "true"
   * and ENVIRONMENT is not "production".
   */
  readonly RATE_LIMITER?: RateLimit;

  /**
   * Test-only. Honored only when exactly "true" and ENVIRONMENT is not "production".
   * wrangler.jsonc must not set this.
   */
  readonly ALLOW_NO_RATE_LIMIT?: string;

  /**
   * Static assets built from data/vpic (scripts/vpic/build-assets.ts): the offline decoder's data.
   */
  readonly ASSETS: Fetcher;

  /**
   * api.data.gov key. Sent only as `X-Api-Key` to api.data.gov and api.nhtsa.gov, never in a URL.
   */
  readonly DATA_GOV_API_KEY?: string;

  /**
   * Shared with the RapidAPI proxy (`X-RapidAPI-Proxy-Secret`).
   * Set with `wrangler secret put`. Never commit the value. Unset fails closed on `/rapid`.
   */
  readonly RAPIDAPI_PROXY_SECRET?: string;

  /**
   * Max VINs on POST /rapid/v1/batch. Digits only. Default 100, ceiling 200.
   * The public batch endpoint stays at 50. Not a secret.
   */
  readonly RAPIDAPI_BATCH_MAX?: string;
}

export type AppVariables = {
  requestId: string;
  startTime: number;
};
