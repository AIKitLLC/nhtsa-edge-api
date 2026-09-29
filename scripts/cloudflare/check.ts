#!/usr/bin/env bun
/**
 * Read-only check of what deploying the custom domain needs on Cloudflare: is the token
 * valid, is the zone on this account, is anything already bound to the hostname, and
 * which of the needed permissions the token has. Only GET requests; the token is never printed.
 *
 * Usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... bun scripts/cloudflare/check.ts [hostname]
 * Exits 1 when something the custom-domain deploy needs is missing.
 */

import { appendFileSync } from "node:fs";

const token = process.env["CLOUDFLARE_API_TOKEN"] ?? "";
const account = process.env["CLOUDFLARE_ACCOUNT_ID"] ?? "";
const hostname = process.argv[2] ?? "data.ai-kit.net";
const zoneName = hostname.split(".").slice(-2).join(".");
const PRODUCTION_WORKER = "nhtsa-edge-api";

if (!token || !account) {
  console.error("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must be set.");
  process.exit(1);
}

interface ApiResult<T> {
  readonly ok: boolean;
  readonly status: number;
  readonly result: T | null;
  readonly error: string;
}

async function api<T>(path: string): Promise<ApiResult<T>> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const body = (await res.json().catch(() => null)) as { success?: boolean; result?: T; errors?: { code: number; message: string }[] } | null;
  const error = (body?.errors ?? []).map((e) => `${e.code}: ${e.message}`).join("; ");
  return { ok: res.ok && body?.success === true, status: res.status, result: body?.result ?? null, error };
}

interface Row {
  readonly check: string;
  readonly needs: string;
  readonly ok: boolean;
  readonly detail: string;
}
const rows: Row[] = [];
const add = (check: string, needs: string, ok: boolean, detail: string): void => void rows.push({ check, needs, ok, detail });
const fail = (r: ApiResult<unknown>): string => `HTTP ${r.status}${r.error ? ` (${r.error})` : ""}`;

// 1. The token itself (account-owned tokens verify under the account, user tokens under /user)
const accountVerify = await api<{ status: string }>(`/accounts/${account}/tokens/verify`);
const userVerify = accountVerify.ok ? accountVerify : await api<{ status: string }>("/user/tokens/verify");
const verified = accountVerify.ok ? accountVerify : userVerify;
add("Token is valid", "any token", verified.ok && verified.result?.status === "active", verified.ok ? `status ${verified.result?.status}` : fail(verified));

// 2. The zone must be on the same account as the Worker
const zones = await api<{ id: string; name: string; status: string; account: { id: string } }[]>(`/zones?name=${zoneName}`);
const zone = zones.result?.find((z) => z.name === zoneName) ?? null;
add(
  `Zone ${zoneName} is visible`,
  "Zone: Zone: Read",
  zones.ok && zone !== null,
  !zones.ok ? fail(zones) : zone ? `id ${zone.id}, status ${zone.status}` : "not found for this token (wrong account, or the token is not scoped to this zone)"
);
if (zone) add(`Zone ${zoneName} is on account ${account.slice(0, 6)}...`, "same account as the Worker", zone.account.id === account, zone.account.id === account ? "same account" : "the zone belongs to a different account");

// 3. What is already bound to the hostname would block or change the deploy
if (zone) {
  const dns = await api<{ type: string; name: string; content: string; proxied: boolean }[]>(`/zones/${zone.id}/dns_records?name=${hostname}`);
  const records = dns.result ?? [];
  // Informational: the custom-domain deploy worked without DNS access on the token
  add(
    `DNS records for ${hostname}`,
    "optional: Zone: DNS: Read",
    !dns.ok || records.length === 0,
    !dns.ok
      ? `not readable with this token (${fail(dns)}); not needed for the deploy`
      : records.length === 0
        ? "none"
        : `existing: ${records.map((r) => `${r.type} ${r.content}${r.proxied ? " (proxied)" : ""}`).join(", ")}; a custom domain will not replace these`
  );
  const routes = await api<{ pattern: string; script?: string }[]>(`/zones/${zone.id}/workers/routes`);
  add(
    "Workers routes on the zone",
    "Zone: Workers Routes: Read (Edit to deploy)",
    routes.ok,
    routes.ok ? `${(routes.result ?? []).length} route(s)${(routes.result ?? []).some((r) => r.pattern.startsWith(hostname)) ? ", one already matches the hostname" : ""}` : fail(routes)
  );
}

// 4. Workers on the account, and any existing custom domain binding
const domains = await api<{ hostname: string; service: string }[]>(`/accounts/${account}/workers/domains?hostname=${hostname}`);
add(
  `Worker custom domain ${hostname}`,
  "Account: Workers Scripts: Read",
  domains.ok && (domains.result ?? []).length === 0,
  !domains.ok ? fail(domains) : (domains.result ?? []).length === 0 ? "not bound yet" : `already bound to Worker ${(domains.result ?? []).map((d) => d.service).join(", ")}`
);
const scripts = await api<{ id: string }[]>(`/accounts/${account}/workers/scripts`);
const names = (scripts.result ?? []).map((s) => s.id);
add(
  "Workers on the account",
  "Account: Workers Scripts: Read",
  scripts.ok,
  scripts.ok ? `${names.length} script(s): production ${names.includes(PRODUCTION_WORKER) ? "exists" : "not deployed yet"}, dev ${names.includes(`${PRODUCTION_WORKER}-dev`) ? "exists" : "not deployed"}` : fail(scripts)
);

const lines = [
  `## Cloudflare check for ${hostname}`,
  "",
  "| Check | Needs | Result | Detail |",
  "| :-- | :-- | :-- | :-- |",
  ...rows.map((r) => `| ${r.check} | ${r.needs} | ${r.ok ? "ok" : "**MISSING**"} | ${r.detail} |`),
  "",
  "Edit permissions cannot be tested without writing. The production deploy has worked with: Account: Workers Scripts: Edit and Zone: Zone: Read on `" + zoneName + "`.",
];
const report = lines.join("\n");
console.log(report);
if (process.env["GITHUB_STEP_SUMMARY"]) appendFileSync(process.env["GITHUB_STEP_SUMMARY"], `${report}\n`);
process.exit(rows.every((r) => r.ok) ? 0 : 1);
