import type { MiddlewareHandler } from "hono";
import type { Env } from "../types/env";
import { jsonError } from "../services/responses";

/** Header RapidAPI adds on every proxied request when a proxy secret is configured. */
const PROXY_SECRET_HEADER = "X-RapidAPI-Proxy-Secret";
/** Logged only. RapidAPI enforces the quota; this value is not an access decision. */
const USER_HEADER = "X-RapidAPI-User";
const SUBSCRIPTION_HEADER = "X-RapidAPI-Subscription";

/**
 * SHA-256 both sides so the compare is fixed-length. A length check on the raw
 * secret would leak how long `RAPIDAPI_PROXY_SECRET` is.
 * Workers provide `crypto.subtle.timingSafeEqual`. The Node test runtime does not,
 * so the same fixed-length hashes are compared byte by byte there.
 */
async function hashesEqual(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === "function") {
    return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
  }

  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let diff = left.byteLength ^ right.byteLength;
  const length = Math.max(left.byteLength, right.byteLength);
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

function logField(value: string | undefined): string {
  if (!value) return "";
  return value.length > 128 ? value.slice(0, 128) : value;
}

/**
 * `/rapid` accepts a request only when `X-RapidAPI-Proxy-Secret` matches the
 * Worker secret `RAPIDAPI_PROXY_SECRET`. Missing config fails closed (403).
 * The same 403 is used for a missing header and a wrong header.
 */
export const rapidProxyMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => {
  return async (c, next) => {
    const expected = c.env.RAPIDAPI_PROXY_SECRET;
    const provided = c.req.header(PROXY_SECRET_HEADER) ?? "";
    const allowed = Boolean(expected) && (await hashesEqual(provided, expected ?? ""));
    if (!allowed || !expected) {
      return jsonError(c, 403, "RAPIDAPI_PROXY_REQUIRED", "This route accepts only RapidAPI proxy requests.");
    }

    console.info(
      JSON.stringify({
        source: "rapidapi",
        rapidApiUser: logField(c.req.header(USER_HEADER)),
        rapidApiSubscription: logField(c.req.header(SUBSCRIPTION_HEADER)),
        method: c.req.method,
        path: c.req.path,
      })
    );
    return next();
  };
};
