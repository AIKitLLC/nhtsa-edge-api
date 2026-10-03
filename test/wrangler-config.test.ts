import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

interface WranglerConfig {
  name: string;
  routes?: { pattern: string; custom_domain?: boolean }[];
  workers_dev?: boolean;
  vars: { ENVIRONMENT: string };
  ratelimits?: { name: string; namespace_id: string }[];
  env: { dev: { name: string; routes?: unknown[]; ratelimits?: { name: string; namespace_id: string }[]; vars: { ENVIRONMENT: string } } };
}

/** wrangler.jsonc without its comments (it has no trailing commas). */
function readConfig(): WranglerConfig {
  const text = readFileSync(resolve(__dirname, "../wrangler.jsonc"), "utf-8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(text) as WranglerConfig;
}

describe("wrangler.jsonc", () => {
  const config = readConfig();

  it("serves production at data.ai-kit.net as a custom domain", () => {
    expect(config.routes).toEqual([{ pattern: "data.ai-kit.net", custom_domain: true }]);
    expect(config.vars.ENVIRONMENT).toBe("production");
  });

  it("keeps the workers.dev URL of production on", () => {
    // With routes configured, wrangler turns workers.dev off unless it is set explicitly
    expect(config.workers_dev).toBe(true);
  });

  it("keeps the dev worker off the production domain", () => {
    // env.dev inherits top-level routes unless it overrides them, and deploying it would
    // then take data.ai-kit.net away from the production worker.
    expect(config.env.dev.routes).toEqual([]);
    expect(config.env.dev.name).not.toBe(config.name);
    expect(config.env.dev.vars.ENVIRONMENT).toBe("dev");
  });

  it("binds the rate limiter in production and dev with separate counters", () => {
    // Bindings are not inherited by env.dev, and a shared namespace_id would share counters
    const prod = config.ratelimits?.[0];
    const dev = config.env.dev.ratelimits?.[0];
    expect(prod?.name).toBe("RATE_LIMITER");
    expect(dev?.name).toBe("RATE_LIMITER");
    expect(prod?.namespace_id).not.toBe(dev?.namespace_id);
  });
});
