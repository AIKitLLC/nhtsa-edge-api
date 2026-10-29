import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../types/env";
import { jsonError } from "../../services/responses";

export const leakRouter = new Hono<{ Bindings: Env }>();

const PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range/";
export const HIBP_USER_AGENT = "AI-Kit-Data/1.0 (+https://data.ai-kit.net)";
const RANGE_TTL_SECONDS = 24 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 5000;

const PrefixSchema = z.string().regex(/^[0-9A-F]{5}$/, "prefix must be the first 5 hex characters of the password's SHA-1");

/** fetch with a timeout whose failures never carry the URL (it can contain an email address). */
export async function fetchQuiet(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new Error(timedOut ? "Leak-check upstream timed out" : "Leak-check upstream unreachable");
  }
}

/**
 * GET /api/v1/leak/password/range/:prefix
 * Pwned Passwords k-anonymity range: the client sends the first 5 hex characters of the SHA-1 of a
 * password and gets back every matching suffix with its breach count (HIBP's text format, padded so
 * the response size does not hint at the prefix). The password itself never reaches this service.
 */
leakRouter.get("/leak/password/range/:prefix", async (c) => {
  const parsed = PrefixSchema.safeParse(c.req.param("prefix").toUpperCase());
  if (!parsed.success) {
    return jsonError(c, 400, "INVALID_HASH_PREFIX", parsed.error.errors[0]?.message ?? "Invalid prefix");
  }

  const upstream = await fetchQuiet(PWNED_PASSWORDS_RANGE_URL + parsed.data, {
    headers: { "Add-Padding": "true", "User-Agent": HIBP_USER_AGENT },
    cf: { cacheTtl: RANGE_TTL_SECONDS, cacheEverything: true },
  });
  if (!upstream.ok) {
    return jsonError(c, 502, "UPSTREAM_ERROR", `Pwned Passwords answered ${upstream.status}.`);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": `public, max-age=${RANGE_TTL_SECONDS}`,
    },
  });
});
