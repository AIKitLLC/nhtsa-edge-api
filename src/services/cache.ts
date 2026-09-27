import { CONFIG } from "../config";
import type { CacheStatus, CacheTier } from "../types/nhtsa";
import type { Env } from "../types/env";

export interface CachedLookupResult {
  readonly bodyText: string;
  readonly status: number;
  readonly headers: Headers;
  readonly tier: CacheTier;
  readonly cacheStatus: CacheStatus;
}

/**
 * Keeps only allow-listed query parameters (matched case-insensitively),
 * renamed to their canonical spelling and sorted.
 * Unknown parameters are dropped so they cannot be used to bust the cache.
 */
export function canonicalQuery(
  params: URLSearchParams,
  allowed: readonly string[]
): URLSearchParams {
  const canonicalByLower = new Map(allowed.map((name) => [name.toLowerCase(), name]));
  const result = new URLSearchParams();

  for (const [key, value] of params.entries()) {
    const canonical = canonicalByLower.get(key.toLowerCase());
    const trimmed = value.trim();
    if (canonical && trimmed !== "" && !result.has(canonical)) {
      result.set(canonical, trimmed);
    }
  }

  result.sort();
  return result;
}

/**
 * Builds a deterministic cache key from already-normalized parts,
 * independent of how the client spelled the request URL.
 */
export function buildCacheKey(
  requestUrl: string,
  parts: readonly string[],
  query?: URLSearchParams
): string {
  const origin = new URL(requestUrl).origin;
  const path = parts.map((p) => encodeURIComponent(p)).join("/");
  const search = query && query.toString() !== "" ? `?${query.toString()}` : "";
  return `${origin}/__cache/${path}${search}`;
}

/**
 * Looks up a response from L1 Edge Cache and optional L2 KV Store.
 */
export async function getFromCache(
  cacheKey: string,
  env?: Env
): Promise<CachedLookupResult | null> {
  // 1. Try L1 Edge Cache API (Cloudflare anycast PoP)
  if (typeof caches !== "undefined" && caches.default) {
    try {
      const edgeResponse = await caches.default.match(cacheKey);
      if (edgeResponse) {
        const bodyText = await edgeResponse.text();
        return {
          bodyText,
          status: edgeResponse.status,
          headers: new Headers(edgeResponse.headers),
          tier: "EDGE_CACHE",
          cacheStatus: "HIT",
        };
      }
    } catch {
      // Edge cache lookup error - continue to fallback
    }
  }

  // 2. Try L2 Cloudflare KV (Persistent global storage)
  if (env?.ENABLE_KV_CACHE === "true" && env.NHTSA_CACHE_KV) {
    try {
      const kvData = await env.NHTSA_CACHE_KV.get(cacheKey, "text");
      if (kvData) {
        const headers = new Headers({
          "Content-Type": "application/json; charset=utf-8",
          [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
          [CONFIG.HEADERS.CACHE_TIER]: "KV",
        });

        return {
          bodyText: kvData,
          status: 200,
          headers,
          tier: "KV",
          cacheStatus: "HIT",
        };
      }
    } catch {
      // KV lookup error - ignore and continue to upstream
    }
  }

  return null;
}

export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Safely extracts ExecutionContext from Hono context without throwing if absent
 */
export function getSafeExecutionContext(c: { executionCtx?: ExecutionContextLike }): ExecutionContextLike | undefined {
  try {
    return c.executionCtx;
  } catch {
    return undefined;
  }
}

/**
 * Stores a response into L1 Edge Cache and optional L2 KV Store.
 */
export async function saveToCache(
  cacheKey: string,
  bodyText: string,
  ttlSeconds: number,
  contentType: string = "application/json; charset=utf-8",
  env?: Env,
  executionCtx?: ExecutionContextLike
): Promise<void> {
  const swrSeconds = CONFIG.CACHE.SWR_TTL_SECONDS;
  const cacheControl = `public, max-age=${ttlSeconds}, s-maxage=${ttlSeconds}, stale-while-revalidate=${swrSeconds}`;

  const headers = new Headers({
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "Access-Control-Allow-Origin": "*",
    [CONFIG.HEADERS.CACHE_STATUS]: "HIT",
    [CONFIG.HEADERS.CACHE_TIER]: "EDGE_CACHE",
  });

  const responseToCache = new Response(bodyText, {
    status: 200,
    headers,
  });

  const putEdgeCache = async () => {
    if (typeof caches !== "undefined" && caches.default) {
      try {
        await caches.default.put(cacheKey, responseToCache);
      } catch {
        // Cache put failure ignored
      }
    }
  };

  const putKv = async () => {
    if (env?.ENABLE_KV_CACHE === "true" && env.NHTSA_CACHE_KV) {
      try {
        // KV expiration in seconds (minimum 60s)
        const kvTtl = Math.max(60, ttlSeconds);
        await env.NHTSA_CACHE_KV.put(cacheKey, bodyText, {
          expirationTtl: kvTtl,
        });
      } catch {
        // KV put failure ignored
      }
    }
  };

  // Perform background caching without blocking response if executionCtx is available
  if (executionCtx) {
    executionCtx.waitUntil(Promise.all([putEdgeCache(), putKv()]));
  } else {
    await Promise.all([putEdgeCache(), putKv()]);
  }
}
