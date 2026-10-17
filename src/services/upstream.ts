import { CONFIG, dataGovKeyHeader, stripApiKeyQuery } from "../config";
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
    apiKey?: string;
  }
): Promise<UpstreamFetchResult> {
  // The coalescing key must not contain the credential, and must not vary by it.
  const targetUrl = stripApiKeyQuery(url);
  const existing = inFlightRequests.get(targetUrl);
  if (existing) {
    return existing;
  }

  const promise = executeFetchWithRetry(targetUrl, options).finally(() => {
    inFlightRequests.delete(targetUrl);
  });

  inFlightRequests.set(targetUrl, promise);
  return promise;
}

async function executeFetchWithRetry(
  url: string,
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    headers?: Record<string, string>;
    apiKey?: string;
  }
): Promise<UpstreamFetchResult> {
  const timeoutMs = options?.timeoutMs ?? CONFIG.UPSTREAM.DEFAULT_TIMEOUT_MS;
  const maxRetries = options?.maxRetries ?? CONFIG.UPSTREAM.MAX_RETRIES;

  let attempt = 0;
  let lastError: Error | null = null;
  const targetUrl = stripApiKeyQuery(url);

  const reqHeaders: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "NHTSA-Cloudflare-Edge-Proxy/1.0",
    ...options?.headers,
  };
  // Any casing: a caller-supplied header must not smuggle the key onto another host.
  for (const name of Object.keys(reqHeaders)) {
    if (name.toLowerCase() === "x-api-key") delete reqHeaders[name];
  }
  const keyHeader = dataGovKeyHeader(targetUrl, options?.apiKey);
  Object.assign(reqHeaders, keyHeader);
  const sendsKey = Object.keys(keyHeader).length > 0;

  while (attempt <= maxRetries) {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: reqHeaders,
        signal: controller.signal,
        // manual: a 3xx must not carry X-Api-Key to a different host.
        redirect: sendsKey ? "manual" : "follow",
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (sendsKey && response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        return { status: 502, headers: new Headers(), bodyText: "", latencyMs };
      }

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
