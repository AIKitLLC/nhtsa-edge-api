import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../types/env";
import { CONFIG } from "../config";
import { rapidProxyMiddleware } from "../middleware/rapid-proxy";
import { jsonError } from "../services/responses";
import { lookupFuelEconomy } from "../services/multi-source-resolver";
import { fetchUpstream, upstreamTimeoutMs } from "../services/upstream";
import { decodeVin } from "../vpic/decode";
import { toV1Spec, type V1VehicleSpec } from "../vpic/v1-format";
import { getVpicStore } from "../vpic/worker-store";
import { FullVinSchema, parseModelYear, parseVin } from "../validation/vin";

/** Public `DecodeVINValuesBatch` stays at 50. This route is larger unless configured down. */
const DEFAULT_BATCH_MAX = 100;
/** shortcut: ceiling 200, raise when a batch of this size stays inside Workers subrequest and CPU limits */
const BATCH_MAX_CEILING = 200;
/** Workers allow 6 simultaneous outgoing connections. Stay under that. */
const UPSTREAM_CONCURRENCY = 4;

const batchBodySchema = z.object({
  vins: z
    .array(
      z.object({
        vin: z.string(),
        modelYear: z.number().int().optional(),
      })
    )
    .min(1),
});

type RecallOutcome = "provided" | "unavailable" | "skipped";

interface RecallSection {
  readonly outcome: RecallOutcome;
  readonly count: number | null;
  readonly campaigns: readonly unknown[] | null;
}

const skippedRecall = (): RecallSection => ({ outcome: "skipped", count: null, campaigns: null });
const unavailableRecall = (): RecallSection => ({ outcome: "unavailable", count: null, campaigns: null });

/**
 * `RAPIDAPI_BATCH_MAX` is a plain var (not a secret). Non-digits and values below 1
 * use the default. Values above the ceiling clamp, so a bad var cannot accept an unbounded body.
 */
export function rapidBatchMax(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_BATCH_MAX;
  if (!/^\d+$/.test(raw.trim())) return DEFAULT_BATCH_MAX;
  const parsed = Number(raw.trim());
  if (parsed < 1) return DEFAULT_BATCH_MAX;
  return Math.min(parsed, BATCH_MAX_CEILING);
}

async function mapPool<T, R>(items: readonly T[], run: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Math.min(UPSTREAM_CONCURRENCY, items.length);
  await Promise.all(
    Array.from({ length: workers }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item === undefined) return;
        results[index] = await run(item);
      }
    })
  );
  return results;
}

function parseRecallBody(bodyText: string): RecallSection {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return unavailableRecall();
  }
  if (typeof parsed !== "object" || parsed === null) return unavailableRecall();
  const record = parsed as Record<string, unknown>;
  const raw = record["results"] ?? record["Results"];
  if (!Array.isArray(raw)) return unavailableRecall();
  const count = typeof record["Count"] === "number" ? record["Count"] : raw.length;
  return { outcome: "provided", count, campaigns: raw };
}

async function fetchRecalls(vin: string, env: Env): Promise<RecallSection> {
  const url = `${CONFIG.UPSTREAM.RECALLS_BASE_URL}/recalls/recallsByVin?vin=${encodeURIComponent(vin)}`;
  try {
    const upstream = await fetchUpstream(url, {
      timeoutMs: upstreamTimeoutMs(env),
      apiKey: env.DATA_GOV_API_KEY,
    });
    if (upstream.status !== 200) return unavailableRecall();
    return parseRecallBody(upstream.bodyText);
  } catch {
    return unavailableRecall();
  }
}

function fuelKey(spec: V1VehicleSpec): string | null {
  if (spec.make === null || spec.model === null || spec.modelYear === null) return null;
  return `${spec.modelYear}\n${spec.make}\n${spec.model}`;
}

/**
 * POST /rapid/v1/batch
 * Offline decode for each VIN, then NHTSA recalls and FuelEconomy.gov data when those
 * sources return them. A source that is down leaves its section empty and the decode stands.
 */
export const rapidRouter = new Hono<{ Bindings: Env }>();

rapidRouter.use("*", rapidProxyMiddleware());

rapidRouter.post("/v1/batch", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, "INVALID_BODY", "Body must be JSON");
  }

  const parsedBody = batchBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return jsonError(c, 400, "INVALID_BODY", parsedBody.error.errors[0]?.message ?? "Invalid body");
  }

  const max = rapidBatchMax(c.env.RAPIDAPI_BATCH_MAX);
  if (parsedBody.data.vins.length > max) {
    return jsonError(c, 400, "BATCH_TOO_LARGE", `At most ${max} VINs per request`);
  }

  const entries: { vin: string; modelYear: number | null }[] = [];
  for (const item of parsedBody.data.vins) {
    const vin = parseVin(item.vin);
    if (!vin.ok) return jsonError(c, 400, "INVALID_VIN_FORMAT", vin.message);
    const year = parseModelYear(item.modelYear === undefined ? undefined : String(item.modelYear));
    if (!year.ok) return jsonError(c, 400, "INVALID_MODEL_YEAR", year.message);
    entries.push({ vin: vin.vin, modelYear: year.value });
  }

  const store = getVpicStore(c.env.ASSETS);
  const specs: V1VehicleSpec[] = [];
  let dataVersion = "";
  for (const entry of entries) {
    const result = await decodeVin(store, entry.vin, { modelYear: entry.modelYear });
    dataVersion = result.dumpVersion;
    specs.push(toV1Spec(result));
  }

  const fuelJobs: { key: string; spec: V1VehicleSpec }[] = [];
  const seenFuel = new Set<string>();
  for (const spec of specs) {
    const key = fuelKey(spec);
    if (key === null || seenFuel.has(key)) continue;
    seenFuel.add(key);
    fuelJobs.push({ key, spec });
  }
  const fuelRows = await mapPool(fuelJobs, ({ spec }) => lookupFuelEconomy(spec));
  const fuelByKey = new Map(fuelJobs.flatMap((job, index) => {
    const row = fuelRows[index];
    return row ? [[job.key, row] as const] : [];
  }));

  const recallVins = [...new Set(specs.filter((spec) => FullVinSchema.safeParse(spec.vin).success).map((spec) => spec.vin))];
  const recallRows = await mapPool(recallVins, (vin) => fetchRecalls(vin, c.env));
  const recallByVin = new Map<string, RecallSection>();
  recallVins.forEach((vin, index) => {
    const row = recallRows[index];
    if (row) recallByVin.set(vin, row);
  });

  const skippedFuel = { outcome: "skipped" as const, data: null };
  const results = specs.map((spec) => {
    const key = fuelKey(spec);
    return {
      decode: spec,
      recalls: recallByVin.get(spec.vin) ?? skippedRecall(),
      fuel: (key !== null ? fuelByKey.get(key) : undefined) ?? skippedFuel,
    };
  });

  c.header("Cache-Control", "private, no-store");
  c.header(CONFIG.HEADERS.DATA_VERSION, dataVersion);
  c.header(CONFIG.HEADERS.DECODE_SOURCE, "LOCAL_VPIC");
  return c.json({
    success: true,
    data: { count: results.length, results },
    timestamp: new Date().toISOString(),
  });
});
