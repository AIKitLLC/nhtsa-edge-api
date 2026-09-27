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
}

export type AppVariables = {
  requestId: string;
  startTime: number;
};
