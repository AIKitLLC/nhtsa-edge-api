import { Hono } from "hono";
import type { Env, AppVariables } from "./types/env";
import { timingMiddleware } from "./middleware/timing";
import { corsMiddleware } from "./middleware/cors";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { errorHandler } from "./middleware/error";
import { healthRouter } from "./routes/health";
import { openapiRouter } from "./routes/openapi";
import { v1Router } from "./routes/v1";
import { vpicProxyRouter } from "./routes/vpic-proxy";
import { recallsProxyRouter } from "./routes/recalls-proxy";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// 1. Global middlewares
app.use("*", timingMiddleware());
app.use("*", corsMiddleware());
app.use("*", rateLimitMiddleware());

// 2. Global error handler
app.onError(errorHandler);

// 3. Routes
// Health, data version and endpoint catalog
app.route("/", healthRouter);

// OpenAPI description and llms.txt
app.route("/", openapiRouter);

// Clean v1 API: offline VIN decode, catalog, recalls
app.route("/api/v1", v1Router);

// Drop-in vPIC API (/vehicles/* and /api/vehicles/*): decode endpoints offline, the rest proxied
app.route("/api", vpicProxyRouter);
app.route("/", vpicProxyRouter);

// NHTSA recalls drop-in proxy (/recalls/*)
app.route("/", recallsProxyRouter);

// 4. 404 handler
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

export { app };

export default {
  fetch: app.fetch,
};
