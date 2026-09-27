import type { MiddlewareHandler } from "hono";
import { CONFIG } from "../config";

/**
 * High precision timing middleware providing Server-Timing and latency metrics
 */
export const timingMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const startTime = performance.now();
    await next();
    const duration = Math.round((performance.now() - startTime) * 100) / 100;

    c.header(CONFIG.HEADERS.RESPONSE_TIME, `${duration}`);
    c.header(CONFIG.HEADERS.SERVER_TIMING, `edge;dur=${duration}`);
  };
};
