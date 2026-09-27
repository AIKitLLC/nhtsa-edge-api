import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/env";

/**
 * Compares two strings in constant time by hashing both first,
 * so neither length nor content leaks through response timing.
 */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const viewA = new Uint8Array(hashA);
  const viewB = new Uint8Array(hashB);
  let diff = 0;
  for (let i = 0; i < viewA.length; i++) {
    diff |= (viewA[i] ?? 0) ^ (viewB[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Protects write/admin endpoints with a bearer token (`ADMIN_TOKEN` secret).
 * Fails closed: when the secret is not configured, the endpoints are disabled.
 */
export const adminAuthMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    const expected = c.env?.ADMIN_TOKEN;
    if (!expected) {
      return c.json(
        {
          success: false,
          error: {
            code: "ADMIN_DISABLED",
            message: "Admin endpoints are disabled. Set the ADMIN_TOKEN secret to enable them.",
          },
        },
        503
      );
    }

    const header = c.req.header("Authorization") ?? "";
    const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";

    if (!provided || !(await safeEqual(provided, expected))) {
      return c.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Missing or invalid bearer token.",
          },
        },
        401
      );
    }

    await next();
    return;
  };
};
