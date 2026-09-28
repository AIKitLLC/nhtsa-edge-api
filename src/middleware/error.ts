import type { ErrorHandler } from "hono";

/**
 * Safe error boundary complying with high-performance doctrine.
 * Ensures consistent JSON error shape and never leaks internal details
 * (upstream URLs, stack traces) to clients; full errors go to the logs.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const isTimeout =
    err.name === "AbortError" || err.message.toLowerCase().includes("timed out");

  const status = isTimeout ? 504 : 500;
  const errorCode = isTimeout ? "UPSTREAM_TIMEOUT" : "INTERNAL_SERVER_ERROR";
  const message = isTimeout
    ? "The NHTSA upstream did not respond in time. Please retry shortly."
    : "An unexpected error occurred processing your request.";

  console.error(`[${errorCode}] ${c.req.method} ${c.req.path}:`, err);

  return c.json(
    {
      success: false,
      error: {
        code: errorCode,
        message,
      },
      timestamp: new Date().toISOString(),
    },
    status
  );
};
