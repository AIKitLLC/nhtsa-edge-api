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
   * Cloudflare D1 Serverless Database for NHTSA local data & parity audit
   */
  readonly DB?: D1Database;

  /**
   * Bearer token guarding /api/v1/sync/* writes and /api/v1/admin/*.
   * Set with: npx wrangler secret put ADMIN_TOKEN
   */
  readonly ADMIN_TOKEN?: string;
}

export type AppVariables = {
  requestId: string;
  startTime: number;
};
