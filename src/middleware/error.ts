import type { ErrorHandler } from "hono";

/**
 * Safe error boundary complying with high-performance doctrine.
 * Ensures consistent JSON error shape and hides sensitive internal stack traces.
 */
export const errorHandler: ErrorHandler = (err, c) => {
  const isTimeout =
    err.name === "AbortError" || err.message.toLowerCase().includes("timed out");

  const status = isTimeout ? 504 : 500;
  const errorCode = isTimeout ? "UPSTREAM_TIMEOUT" : "INTERNAL_SERVER_ERROR";

  return c.json(
    {
      success: false,
      error: {
        code: errorCode,
        message: err.message || "An unexpected error occurred processing your request.",
      },
      timestamp: new Date().toISOString(),
    },
    status
  );
};
