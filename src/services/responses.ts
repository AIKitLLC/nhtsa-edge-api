import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Uniform JSON error envelope used by every v1 route.
 */
export function jsonError(
  c: Context,
  status: ContentfulStatusCode,
  code: string,
  message: string,
  extra?: Record<string, unknown>
): Response {
  return c.json(
    {
      success: false,
      error: { code, message },
      ...extra,
      timestamp: new Date().toISOString(),
    },
    status
  );
}
