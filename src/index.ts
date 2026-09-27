import { Hono } from "hono";
import type { Env, AppVariables } from "./types/env";
import { timingMiddleware } from "./middleware/timing";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler } from "./middleware/error";
import { adminAuthMiddleware } from "./middleware/admin-auth";
import { healthRouter } from "./routes/health";
import { v1Router } from "./routes/v1";
import { vpicProxyRouter } from "./routes/vpic-proxy";
import { recallsProxyRouter } from "./routes/recalls-proxy";
import { syncRouter } from "./routes/sync";
import { runIncrementalSync } from "./services/api-syncer";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// 1. Global Middlewares
app.use("*", timingMiddleware());
app.use("*", corsMiddleware());

// 2. Global Error Handler
app.onError(errorHandler);

// 3. Admin protection: every write/sync operation requires the ADMIN_TOKEN bearer
app.use("/api/v1/admin/*", adminAuthMiddleware());
app.on("POST", "/api/v1/sync/*", adminAuthMiddleware());

// 4. Mount Routes
// Health & API Catalog at root
app.route("/", healthRouter);

// High-performance clean v1 API (/api/v1/vin/:vin, /api/v1/makes, etc.)
app.route("/api/v1", v1Router);

// Dual-Channel Sync Management (/api/v1/sync/*)
app.route("/api/v1/sync", syncRouter);

// 100% transparent drop-in VPIC proxy (matching both /api/vehicles/* and /vehicles/*)
app.route("/api", vpicProxyRouter);
app.route("/", vpicProxyRouter);

// NHTSA Recalls drop-in proxy (/recalls/*)
app.route("/", recallsProxyRouter);

// 5. 404 Not Found Handler
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
  /**
   * Automated Cloudflare Worker Cron Trigger (Nightly Incremental API Sync)
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      runIncrementalSync(env).then((res) => {
        console.log(`[Cron Sync] Successfully synced ${res.totalModelsSynced} models across ${res.totalMakesProcessed} makes at ${res.timestamp}`);
      }).catch((err) => {
        console.error("[Cron Sync] Error during nightly sync:", err);
      })
    );
  },
};
