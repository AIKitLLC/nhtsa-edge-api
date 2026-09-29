import { describe, it, expect, vi } from "vitest";
import { app } from "../src/index";
import { DATASETS, renderHub, renderVpicPage, SAMPLE_VINS, type PageInfo } from "../src/routes/landing";
import { LANDING_JS } from "../src/routes/landing/script";
import { testEnv } from "./helpers/assets";

const browser = { headers: { Accept: "text/html" } };
const get = async (path: string, init?: RequestInit): Promise<Response> => app.request(path, init, testEnv());

const hostile: PageInfo = {
  colo: "<img src=x onerror=alert(1)>",
  country: '"><script>alert(2)</script>',
  dataVersion: "<b>v</b>",
  healthy: true,
  stats: null,
  nonce: "n",
};

describe("Hub (/)", () => {
  it("lists every dataset with its honest status, and the data version", async () => {
    const res = await get("/", browser);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
    const html = await res.text();

    expect(html).toContain('id="datasets"');
    expect(html).toContain("AI Kit LLC");
    for (const d of DATASETS) {
      expect(html).toContain(`id="${d.id}"`);
      expect(html).toContain(d.name.replace(/&/g, "&amp;"));
    }
    expect(html).toContain('class="status live">Live<');
    expect(html).toContain('class="status planned">Planned<');
    expect(html).toMatch(/vPICList_lite_/);
    // Counts come from stats.json
    const stats = JSON.parse(await (await testEnv().ASSETS.fetch(new Request("https://x/vpic/stats.json"))).text());
    expect(html).toContain(stats.models.toLocaleString("en-US"));
    expect(html).toContain(stats.patterns.toLocaleString("en-US"));
  });

  it("only links to pages that exist", async () => {
    const html = await (await get("/", browser)).text();
    const internal = [...html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)].map((m) => m[1] as string);
    expect(internal.length).toBeGreaterThan(0);
    for (const path of new Set(internal)) {
      const res = await get(path, browser);
      expect(res.status, path).toBe(200);
    }
  });

  it("keeps the dataset registry consistent", () => {
    expect(new Set(DATASETS.map((d) => d.id)).size).toBe(DATASETS.length);
    for (const d of DATASETS) {
      expect(["live", "partial", "planned"]).toContain(d.status);
      // A planned dataset has nothing to link to yet
      if (d.status === "planned") expect(d.links).toHaveLength(0);
    }
    expect(DATASETS.some((d) => d.status === "live")).toBe(true);
  });

  it("keeps answering API clients with JSON on the same URL", async () => {
    const res = await get("/");
    expect(res.headers.get("Content-Type")).toMatch(/json/);
    expect(res.headers.get("Vary")).toContain("Accept");
    const json = (await res.json()) as { status: string; dataVersion: string; datasets: Record<string, string> };
    expect(json.status).toBe("healthy");
    expect(json.dataVersion).toMatch(/^vPICList_lite_/);
    expect(json.datasets["vpic"]).toContain("live");
  });

  it("has /health as JSON even for a browser-like Accept header", async () => {
    const res = await get("/health", browser);
    expect(res.headers.get("Content-Type")).toMatch(/json/);
    expect(((await res.json()) as { status: string }).status).toBe("healthy");
  });
});

describe("VIN decoder page (/vpic)", () => {
  it("serves the decoder and the vPIC numbers", async () => {
    const res = await get("/vpic");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('id="vin-form"');
    expect(html).toContain('id="result"');
    expect(html).toMatch(/vPICList_lite_/);
    const stats = JSON.parse(await (await testEnv().ASSETS.fetch(new Request("https://x/vpic/stats.json"))).text());
    expect(html).toContain(stats.wmis.toLocaleString("en-US"));
    expect(html).toContain(stats.patterns.toLocaleString("en-US"));
  });

  it.each(SAMPLE_VINS)("the %s quick-pick decodes cleanly to the make it is labelled with", async (label, vin) => {
    const res = await get(`/api/v1/vin/${vin}`);
    const { data } = (await res.json()) as { data: { make: string; isCleanDecode: boolean; model: string } };
    expect(data.isCleanDecode).toBe(true);
    expect(`${data.make} ${data.model}`.toLowerCase()).toContain(label.split(" ")[0]?.toLowerCase());
  });

  it("ships a client script that compiles and never writes HTML from API data", () => {
    expect(() => new Function(LANDING_JS)).not.toThrow();
    expect(LANDING_JS).not.toContain("innerHTML");
    expect(LANDING_JS).not.toContain("outerHTML");
    expect(LANDING_JS).not.toContain("document.write");
  });
});

describe.each(["/", "/vpic"])("Security and caching of %s", (path) => {
  it("sets a nonce-based CSP that matches the inline tags, fresh for every response", async () => {
    const res = await get(path, browser);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    const html = await res.text();
    expect(html).toContain(`<style nonce="${nonce}">`);
    expect(html.match(/<style/g)).toHaveLength(1);
    expect(html.match(/<script/g)?.length ?? 0).toBeLessThanOrEqual(1);
    if (html.includes("<script")) expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).not.toMatch(/\son[a-z]+="/);
    expect((await get(path, browser)).headers.get("Content-Security-Policy")).not.toBe(csp);
  });

  it("shows the degraded state (503, not cached) when the data assets are unreadable", async () => {
    vi.resetModules();
    const { app: fresh } = await import("../src/index");
    const broken = { ASSETS: { fetch: async () => new Response("", { status: 500 }) } as unknown as Fetcher };
    const res = await fresh.request(path, browser, broken);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("Degraded");
    expect(html).toContain('role="alert"');
  });
});

describe("Escaping", () => {
  it.each([
    ["hub", renderHub],
    ["decoder page", renderVpicPage],
  ])("the %s escapes everything it prints", (_name, render) => {
    const html = render(hostile);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(2)");
    expect(html).not.toContain("<b>v</b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
