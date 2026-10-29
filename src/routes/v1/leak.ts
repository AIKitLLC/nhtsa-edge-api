import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../types/env";
import { jsonError } from "../../services/responses";

export const leakRouter = new Hono<{ Bindings: Env }>();

const PWNED_PASSWORDS_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_BREACHED_ACCOUNT_URL = "https://haveibeenpwned.com/api/v3/breachedaccount/";
const HIBP_USER_AGENT = "AI-Kit-Data/1.0 (+https://data.ai-kit.net)";
const RANGE_TTL_SECONDS = 24 * 60 * 60;
const UPSTREAM_TIMEOUT_MS = 5000;

// HIBP licenses breach data under CC BY 4.0: every response must name and link the source.
const SOURCE = { name: "Have I Been Pwned", url: "https://haveibeenpwned.com", license: "CC BY 4.0" } as const;

const PrefixSchema = z.string().regex(/^[0-9A-F]{5}$/, "prefix must be the first 5 hex characters of the password's SHA-1");
const EmailBodySchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });

/** Breach fields returned to clients; HIBP sends PascalCase objects with more fields. */
interface HibpBreach {
  readonly Name: string;
  readonly Title: string;
  readonly Domain: string;
  readonly BreachDate: string;
  readonly PwnCount: number;
  readonly DataClasses: readonly string[];
  readonly IsVerified: boolean;
  readonly IsSensitive: boolean;
}

/** fetch with a timeout whose failures never carry the URL (it can contain an email address). */
async function fetchQuiet(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new Error(timedOut ? "Leak-check upstream timed out" : "Leak-check upstream unreachable");
  }
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** Constant-time token check: digests have a fixed length, so no length or prefix leaks. */
async function tokenMatches(given: string, expected: string): Promise<boolean> {
  const [a, b] = await Promise.all([sha256(given), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
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

/**
 * POST /api/v1/leak/email  {"email": "..."}
 * Breaches containing an email address, from HIBP's paid API. Requires `Authorization: Bearer <LEAK_API_TOKEN>`
 * so the HIBP key is not an open enumeration service. The email is never cached, logged or put in a URL
 * this service serves. Sensitive breaches are dropped: HIBP shows those only to verified owners.
 */
leakRouter.post("/leak/email", async (c) => {
  const { HIBP_API_KEY, LEAK_API_TOKEN } = c.env;
  if (!HIBP_API_KEY || !LEAK_API_TOKEN) {
    return jsonError(c, 503, "NOT_CONFIGURED", "Email breach lookup is not configured on this deployment.");
  }

  const auth = c.req.header("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!(await tokenMatches(token, LEAK_API_TOKEN))) {
    return jsonError(c, 401, "UNAUTHORIZED", "A valid 'Authorization: Bearer <token>' header is required.");
  }

  const limiter = c.env.LEAK_RATE_LIMITER;
  if (limiter && !(await limiter.limit({ key: c.req.header("CF-Connecting-IP") ?? "unknown" }).catch(() => ({ success: true }))).success) {
    c.header("Retry-After", "60");
    return jsonError(c, 429, "RATE_LIMITED", "Too many email lookups. Wait a minute and retry.");
  }

  const body = EmailBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!body.success) {
    return jsonError(c, 400, "INVALID_EMAIL", "Send a JSON body {\"email\": \"name@example.com\"}.");
  }

  const upstream = await fetchQuiet(`${HIBP_BREACHED_ACCOUNT_URL}${encodeURIComponent(body.data.email)}?truncateResponse=false`, {
    headers: { "hibp-api-key": HIBP_API_KEY, "User-Agent": HIBP_USER_AGENT, Accept: "application/json" },
  });
  c.header("Cache-Control", "no-store");

  if (upstream.status === 404) {
    return c.json({ success: true, data: { breached: false, breachCount: 0, breaches: [] }, source: SOURCE });
  }
  if (upstream.status === 429) {
    c.header("Retry-After", upstream.headers.get("retry-after") ?? "10");
    return jsonError(c, 429, "UPSTREAM_RATE_LIMITED", "The breach database is busy. Retry after the delay in Retry-After.");
  }
  if (upstream.status === 401 || upstream.status === 403) {
    console.error(`[LEAK] HIBP rejected the API key (${upstream.status})`);
    return jsonError(c, 503, "NOT_CONFIGURED", "Email breach lookup is not configured on this deployment.");
  }
  if (!upstream.ok) {
    return jsonError(c, 502, "UPSTREAM_ERROR", `The breach database answered ${upstream.status}.`);
  }

  const breaches = ((await upstream.json()) as HibpBreach[])
    .filter((b) => !b.IsSensitive)
    .map((b) => ({
      name: b.Name,
      title: b.Title,
      domain: b.Domain,
      breachDate: b.BreachDate,
      pwnCount: b.PwnCount,
      dataClasses: b.DataClasses,
      isVerified: b.IsVerified,
    }));
  return c.json({ success: true, data: { breached: breaches.length > 0, breachCount: breaches.length, breaches }, source: SOURCE });
});
