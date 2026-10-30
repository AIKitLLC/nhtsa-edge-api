import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "../types/env";

/** Pages and health checks are cheap and cacheable: only API traffic is limited. */
const UNLIMITED_PATHS = new Set(["/", "/health", "/vpic", "/batch", "/docs", "/openapi.json", "/llms.txt"]);

/**
 * `/rapid` is gated by the proxy secret. The connecting IP is the RapidAPI proxy,
 * so the per-IP limiter would count every caller as one. RapidAPI applies the quota.
 */
function isRapidPath(path: string): boolean {
  return path === "/rapid" || path.startsWith("/rapid/");
}

/**
 * Per-client rate limit using the Workers Rate Limiting binding (RATE_LIMITER).
 *
 * Fail closed: HTTP 503, not 429, when the binding is missing or throws. The client is not over
 * the limit, but unlimited traffic must not reach NHTSA or the data.gov quota. Retry-After tells
 * the client to back off. 429 stays reserved for a real limit.
 * The only bypass is ALLOW_NO_RATE_LIMIT=true while ENVIRONMENT is not production (tests).
 * Limits are enforced per Cloudflare location.
 */
function unavailable(c: Context<{ Bindings: Env }>): Response {
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

export const rateLimitMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    if (c.req.method === "OPTIONS" || UNLIMITED_PATHS.has(c.req.path) || isRapidPath(c.req.path)) return next();

    const limiter = c.env?.RATE_LIMITER;
    const allowMissing = c.env?.ALLOW_NO_RATE_LIMIT === "true" && c.env?.ENVIRONMENT !== "production";
    if (!limiter) {
      if (allowMissing) return next();
      return unavailable(c);
    }

    const client = c.req.header("CF-Connecting-IP") ?? "unknown";
    let allowed = true;
    try {
      allowed = (await limiter.limit({ key: client })).success;
    } catch (err) {
      console.error("[RATE_LIMITER] binding error, rejecting request:", err);
      return unavailable(c);
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
