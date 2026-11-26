import { Hono } from "hono";
import type { Env } from "../../types/env";
import { getForm144Day, getForm144Manifest, type SaleNotice } from "../../form144/store";
import { jsonError } from "../../services/responses";

export const form144Router = new Hono<{ Bindings: Env }>();

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

/**
 * GET /api/v1/form144[?ticker=AAPL][&cik=320193][&from=2026-11-01][&to=2026-11-18][&limit=50]
 * SEC Form 144 insider sale notices from the bundled EDGAR cache, newest first.
 * Without from/to, every cached day is searched; `total` counts all matches,
 * `count` the records returned after `limit`.
 */
form144Router.get("/form144", async (c) => {
  const ticker = c.req.query("ticker")?.trim().toUpperCase() || undefined;
  const cikParam = c.req.query("cik")?.trim() || undefined;
  const from = c.req.query("from")?.trim() || undefined;
  const to = c.req.query("to")?.trim() || undefined;
  const limitParam = c.req.query("limit")?.trim() || undefined;

  if (ticker !== undefined && ticker.length > 12) return jsonError(c, 400, "INVALID_QUERY", "'ticker' is too long");
  let cik: string | undefined;
  if (cikParam !== undefined) {
    if (!/^\d{1,10}$/.test(cikParam)) return jsonError(c, 400, "INVALID_QUERY", "'cik' must be a number (e.g. ?cik=320193)");
    cik = String(Number(cikParam));
  }
  if (from !== undefined && !DATE.test(from)) return jsonError(c, 400, "INVALID_QUERY", "'from' must be a date (YYYY-MM-DD)");
  if (to !== undefined && !DATE.test(to)) return jsonError(c, 400, "INVALID_QUERY", "'to' must be a date (YYYY-MM-DD)");
  if (from !== undefined && to !== undefined && from > to) return jsonError(c, 400, "INVALID_QUERY", "'from' must not be after 'to'");
  let limit = DEFAULT_LIMIT;
  if (limitParam !== undefined) {
    const n = Number(limitParam);
    if (!Number.isInteger(n) || n < 1) return jsonError(c, 400, "INVALID_QUERY", "'limit' must be a positive integer");
    limit = Math.min(n, MAX_LIMIT);
  }

  const manifest = await getForm144Manifest(c.env.ASSETS);
  if (!manifest) return jsonError(c, 404, "NOT_FOUND", "No Form 144 data is bundled");
  const dates = manifest.days.map((d) => d.date).filter((d) => (from === undefined || d >= from) && (to === undefined || d <= to));
  const shards = await Promise.all(dates.map((d) => getForm144Day(c.env.ASSETS, d)));
  const matches: SaleNotice[] = [];
  for (const shard of shards) {
    for (const notice of shard?.notices ?? []) {
      if (ticker !== undefined && notice.ticker !== ticker) continue;
      if (cik !== undefined && notice.cik !== cik) continue;
      matches.push(notice);
    }
  }
  matches.sort((a, b) => b.filing_date.localeCompare(a.filing_date) || a.accession_number.localeCompare(b.accession_number));

  c.header("Cache-Control", CACHE_CONTROL);
  return c.json({
    success: true,
    count: Math.min(limit, matches.length),
    total: matches.length,
    sale_notices: matches.slice(0, limit),
    source: "SEC_EDGAR",
    dataVersion: `form144-${manifest.coverage.to}`,
    coverage: manifest.coverage,
    timestamp: new Date().toISOString(),
  });
});
