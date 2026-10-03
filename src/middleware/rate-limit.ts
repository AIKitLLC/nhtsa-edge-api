import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/env";

/** Pages and health checks are cheap and cacheable: only API traffic is limited. */
const UNLIMITED_PATHS = new Set(["/", "/health", "/vpic"]);

/**
 * Per-client rate limit using the Workers Rate Limiting binding (RATE_LIMITER).
 *
 * Fails open: without the binding (tests, local dev) or if the binding errors, requests pass,
 * because a limiter outage must not become an API outage. Limits are enforced per Cloudflare
 * location, which is enough to stop one client from running up the bill.
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
      console.error("[RATE_LIMITER] binding error, allowing request:", err);
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
