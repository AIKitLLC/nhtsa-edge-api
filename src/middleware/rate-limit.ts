import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/env";

/** Pages and health checks are cheap and cacheable: only API traffic is limited. */
const UNLIMITED_PATHS = new Set(["/", "/health", "/vpic", "/batch", "/docs", "/openapi.json", "/llms.txt"]);

/**
 * Per-client rate limit using the Workers Rate Limiting binding (RATE_LIMITER).
 *
 * Fail closed when the binding throws: HTTP 503, not 429. The client is not over the limit,
 * but a limiter outage must not become unlimited traffic against NHTSA or the data.gov quota.
 * Retry-After tells the client to back off. 429 stays reserved for a real limit.
 * No binding at all (tests, local dev without the binding) still passes: there is no backend to fail.
 * Limits are enforced per Cloudflare location.
 */
export const rateLimitMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    const limiter = c.env?.RATE_LIMITER;
    if (!limiter || c.req.method === "OPTIONS" || UNLIMITED_PATHS.has(c.req.path)) return next();

    const client = c.req.header("CF-Connecting-IP") ?? "unknown";
    let allowed = true;
    try {
      allowed = (await limiter.limit({ key: client })).success;
    } catch (err) {
      console.error("[RATE_LIMITER] binding error, rejecting request:", err);
      c.header("Retry-After", "60");
      return c.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_UNAVAILABLE",
            message: "The rate limiter is unavailable. Retry shortly.",
          },
          timestamp: new Date().toISOString(),
        },
        503
      );
    }
    if (allowed) return next();

    c.header("Retry-After", "60");
    return c.json(
      {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Wait a minute and retry, or batch VINs with POST /vehicles/DecodeVINValuesBatch/.",
        },
        timestamp: new Date().toISOString(),
      },
      429
    );
  };
};
