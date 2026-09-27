import { CONFIG } from "../config";
import type { Env } from "../types/env";

export interface UpstreamFetchResult {
  readonly status: number;
  readonly headers: Headers;
  readonly bodyText: string;
  readonly latencyMs: number;
}

// Only gateway-style failures are worth retrying; a plain 500 or a 429 would
// just be repeated, adding load on NHTSA without improving the outcome.
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([502, 503, 504]);

/**
 * Reads the UPSTREAM_TIMEOUT_MS var, falling back to the default for missing/invalid values.
 */
export function upstreamTimeoutMs(env?: Env): number {
  const parsed = Number.parseInt(env?.UPSTREAM_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : CONFIG.UPSTREAM.DEFAULT_TIMEOUT_MS;
}

// In-flight map for request coalescing across concurrent requests (per isolate)
const inFlightRequests = new Map<string, Promise<UpstreamFetchResult>>();

/**
 * Executes an HTTP fetch to upstream NHTSA with timeout, retries, and request coalescing.
 */
export async function fetchUpstream(
  url: string,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
  }
): Promise<UpstreamFetchResult> {
  // Check if an identical request is already currently in flight
  const existing = inFlightRequests.get(url);
  if (existing) {
    return existing;
  }

  const promise = executeFetchWithRetry(url, options).finally(() => {
    inFlightRequests.delete(url);
  });

  inFlightRequests.set(url, promise);
  return promise;
}

async function executeFetchWithRetry(
  url: string,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
  }
): Promise<UpstreamFetchResult> {
  const timeoutMs = options?.timeoutMs ?? CONFIG.UPSTREAM.DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? CONFIG.UPSTREAM.MAX_RETRIES;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "NHTSA-Cloudflare-Edge-Proxy/1.0",
          ...options?.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (RETRYABLE_STATUSES.has(response.status) && attempt < maxRetries) {
        attempt++;
        const backoff = CONFIG.UPSTREAM.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      const bodyText = await response.text();

      return {
        status: response.status,
        headers: response.headers,
        bodyText,
        latencyMs,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === "AbortError";
      lastError = isAbort
        ? new Error(`Upstream request timed out after ${timeoutMs}ms: ${url}`)
        : err instanceof Error
        ? err
        : new Error(String(err));

      if (attempt < maxRetries) {
        attempt++;
        const backoff = CONFIG.UPSTREAM.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }

      break;
    }
  }

  throw lastError ?? new Error(`Failed to fetch upstream URL: ${url}`);
}
