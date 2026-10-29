import type { Context } from "hono";
import { CONFIG } from "../config";
import type { Env } from "../types/env";
import { getFromCache, getSafeExecutionContext, saveToCache } from "./cache";
import { fetchUpstream, upstreamTimeoutMs, type UpstreamFetchResult } from "./upstream";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
/** Repeated failures of an allowlisted URL must not call upstream (and spend quota) on every retry. */
const ERROR_CACHE_TTL_SECONDS = 60;

function ttlForUpstreamStatus(status: number, okTtlSeconds: number): number | null {
  if (status === 200) return okTtlSeconds;
  if (status >= 400) return ERROR_CACHE_TTL_SECONDS;
  return null;
}

function statusFromCache(headers: Headers, fallback: number): number {
  const marked = headers.get(CONFIG.HEADERS.CACHED_STATUS);
  if (!marked) return fallback;
  const status = Number(marked);
  return Number.isInteger(status) && status >= 200 && status <= 599 ? status : fallback;
}

/**
 * Result of turning an upstream response into what the client receives.
 * `cacheBody` lets the cached copy differ from the first response (e.g. source flags).
 */
export interface TransformedBody {
  readonly status: number;
  readonly body: string;
  readonly cacheBody?: string;
}

export interface CachedUpstreamOptions {
  readonly cacheKey: string;
  readonly upstreamUrl: string;
  readonly ttlSeconds: number;
  readonly transform?: (upstream: UpstreamFetchResult) => TransformedBody;
}

export function cacheControlHeader(ttlSeconds: number): string {
  return `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${CONFIG.CACHE.SWR_TTL_SECONDS}`;
}

/** Short cache for an upstream error: no stale-while-revalidate, so a recovery shows up within the TTL. */
function errorCacheControl(): string {
  return `public, max-age=${ERROR_CACHE_TTL_SECONDS}, s-maxage=${ERROR_CACHE_TTL_SECONDS}`;
}

/**
 * Single read-through cache flow shared by every cached route:
 * cache lookup -> upstream fetch -> optional transform -> cache the response -> respond.
 */
export async function serveCachedUpstream(
  c: Context<{ Bindings: Env }>,
  options: CachedUpstreamOptions
): Promise<Response> {
  const { cacheKey, upstreamUrl, ttlSeconds, transform } = options;

  const cached = await getFromCache(cacheKey, c.env);
  if (cached) {
    const status = statusFromCache(cached.headers, cached.status);
    return new Response(cached.bodyText, {
      status,
      headers: {
        "Content-Type": JSON_CONTENT_TYPE,
        "Cache-Control": status === 200 ? cacheControlHeader(ttlSeconds) : errorCacheControl(),
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
      },
    });
  }

  const upstream = await fetchUpstream(upstreamUrl, {
    timeoutMs: upstreamTimeoutMs(c.env),
    apiKey: c.env?.DATA_GOV_API_KEY,
  });
  const result: TransformedBody = transform
    ? transform(upstream)
    : { status: upstream.status, body: upstream.bodyText };

  const storeTtl = ttlForUpstreamStatus(result.status, ttlSeconds);
  if (storeTtl !== null) {
    await saveToCache(
      cacheKey,
      result.cacheBody ?? result.body,
      storeTtl,
      JSON_CONTENT_TYPE,
      c.env,
      getSafeExecutionContext(c),
      result.status
    );
  }

  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": JSON_CONTENT_TYPE,
      "Cache-Control": result.status === 200 ? cacheControlHeader(ttlSeconds) : storeTtl !== null ? errorCacheControl() : "no-store",
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: "UPSTREAM",
      [CONFIG.HEADERS.UPSTREAM_TIME]: `${upstream.latencyMs}`,
    },
  });
}
