import { CONFIG } from "../config";

export interface UpstreamFetchResult {
  readonly status: number;
  readonly headers: Headers;
  readonly bodyText: string;
  readonly latencyMs: number;
}

// In-flight map for request coalescing across concurrent requests
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

      // Check if upstream server returned 502/503/504
      if (response.status >= 500 && attempt < maxRetries) {
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
