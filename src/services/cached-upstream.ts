import type { Context } from "hono";
import { CONFIG } from "../config";
import type { Env } from "../types/env";
import { getFromCache, getSafeExecutionContext, saveToCache } from "./cache";
import { fetchUpstream, upstreamTimeoutMs, type UpstreamFetchResult } from "./upstream";

const JSON_CONTENT_TYPE = "application/json; charset=utf-8";

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

/**
 * Single read-through cache flow shared by every cached route:
 * cache lookup -> upstream fetch -> optional transform -> cache 200s -> respond.
 */
export async function serveCachedUpstream(
  c: Context<{ Bindings: Env }>,
  options: CachedUpstreamOptions
): Promise<Response> {
  const { cacheKey, upstreamUrl, ttlSeconds, transform } = options;

  const cached = await getFromCache(cacheKey, c.env);
  if (cached) {
    return new Response(cached.bodyText, {
      status: 200,
      headers: {
        "Content-Type": JSON_CONTENT_TYPE,
        "Cache-Control": cacheControlHeader(ttlSeconds),
        [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
        [CONFIG.HEADERS.CACHE_TIER]: cached.tier,
      },
    });
  }

  const upstream = await fetchUpstream(upstreamUrl, { timeoutMs: upstreamTimeoutMs(c.env) });
  const result: TransformedBody = transform
    ? transform(upstream)
    : { status: upstream.status, body: upstream.bodyText };

  if (result.status === 200) {
    await saveToCache(
      cacheKey,
      result.cacheBody ?? result.body,
      ttlSeconds,
      JSON_CONTENT_TYPE,
      c.env,
      getSafeExecutionContext(c)
    );
  }

  return new Response(result.body, {
    status: result.status,
    headers: {
      "Content-Type": JSON_CONTENT_TYPE,
      "Cache-Control": result.status === 200 ? cacheControlHeader(ttlSeconds) : "no-store",
      [CONFIG.HEADERS.CACHE_STATUS]: "MISS",
      [CONFIG.HEADERS.CACHE_TIER]: "UPSTREAM",
      [CONFIG.HEADERS.UPSTREAM_TIME]: `${upstream.latencyMs}`,
    },
  });
}
