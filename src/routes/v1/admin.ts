import { Hono } from "hono";
import type { Env } from "../../types/env";
import { seedInitialD1Data } from "../../services/d1-database";
import { jsonError } from "../../services/responses";

/**
 * Admin routes. Protected by adminAuthMiddleware (mounted in src/index.ts).
 */
export const adminRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/admin/seed
 * Seeds the built-in top-manufacturer WMI list into D1.
 */
adminRouter.post("/admin/seed", async (c) => {
  if (!c.env?.DB) {
    return jsonError(c, 400, "D1_NOT_BOUND", "Cloudflare D1 database binding 'DB' is not configured.");
  }

  const inserted = await seedInitialD1Data(c.env.DB);
  return c.json({
    success: true,
    message: `Successfully seeded ${inserted} WMI entries into Cloudflare D1.`,
  });
});
