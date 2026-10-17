import type { MiddlewareHandler } from "hono";

/**
 * One year, this host only. includeSubDomains is omitted so names under the parent zone stay untouched.
 */
const HSTS = "max-age=31536000";

const DEFAULT_CSP = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

/**
 * Baseline headers for every response. HTML pages replace the CSP with a nonce policy of their own.
 * Call before the route so `c.json` keeps the headers, and again after (except CSP) so a raw
 * Response still carries them.
 */
export function applySecurityHeaders(c: { header: (name: string, value: string) => void }, includeCsp: boolean): void {
  c.header("Strict-Transport-Security", HSTS);
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (includeCsp) c.header("Content-Security-Policy", DEFAULT_CSP);
}

export const securityHeadersMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    applySecurityHeaders(c, true);
    await next();
    // Do not replace a nonce CSP the HTML route already set.
    applySecurityHeaders(c, false);
  };
};
