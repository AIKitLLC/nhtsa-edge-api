import { Hono } from "hono";
import type { Env, AppVariables } from "./types/env";
import { timingMiddleware } from "./middleware/timing";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error";
import { healthRouter } from "./routes/health";
import { v1Router } from "./routes/v1-optimized";
import { vpicProxyRouter } from "./routes/vpic-proxy";
import { recallsProxyRouter } from "./routes/recalls-proxy";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// 1. Global Middlewares
app.use("*", timingMiddleware());
app.use("*", corsMiddleware());

// 2. Global Error Handler
app.onError(errorHandler);

// 3. Mount Routes
// Health & API Catalog at root
app.route("/", healthRouter);

// High-performance clean v1 API (/api/v1/vin/:vin, /api/v1/makes, etc.)
app.route("/api/v1", v1Router);

// 100% transparent drop-in VPIC proxy (matching both /api/vehicles/* and /vehicles/*)
app.route("/api", vpicProxyRouter);
app.route("/", vpicProxyRouter);

// NHTSA Recalls drop-in proxy (/recalls/*)
app.route("/", recallsProxyRouter);

// 4. 404 Not Found Handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route '${c.req.path}' not found. Visit '/' for available endpoints.`,
      },
      timestamp: new Date().toISOString(),
    },
    404
  );
});

export default app;
