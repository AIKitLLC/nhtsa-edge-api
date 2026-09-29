import { describe, it, expect, vi } from "vitest";
import { app } from "../src/index";
import { renderLanding, SAMPLE_VINS } from "../src/routes/landing";
import { LANDING_JS } from "../src/routes/landing/script";
import { testEnv } from "./helpers/assets";

const browser = { headers: { Accept: "text/html" } };
const page = async (): Promise<Response> => app.request("/", browser, testEnv());

describe("Landing page", () => {
  it("serves the decoder, the real data numbers and the branding to browsers", async () => {
    const res = await page();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/html/);
    const html = await res.text();

    expect(html).toContain('id="vin-form"');
    expect(html).toContain('id="result"');
    expect(html).toContain("AI Kit LLC");
    expect(html).toMatch(/vPICList_lite_/);
    // Counts come from stats.json, not from text written by hand
    const stats = JSON.parse(await (await testEnv().ASSETS.fetch(new Request("https://x/vpic/stats.json"))).text());
    expect(html).toContain(stats.wmis.toLocaleString("en-US"));
    expect(html).toContain(stats.patterns.toLocaleString("en-US"));
  });

  it("varies on Accept and sets a nonce-based CSP that matches the inline tags", async () => {
    const res = await page();
    expect(res.headers.get("Vary")).toContain("Accept");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("connect-src 'self'");
    const html = await res.text();
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).toContain(`<style nonce="${nonce}">`);
    // No other inline script or style, no inline handlers
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html.match(/<style/g)).toHaveLength(1);
    expect(html).not.toMatch(/\son[a-z]+="/);
    // A fresh nonce for every response
    const other = (await page()).headers.get("Content-Security-Policy");
    expect(other).not.toBe(csp);
  });

  it("keeps answering API clients with JSON on the same URL", async () => {
    const res = await app.request("/", undefined, testEnv());
    expect(res.headers.get("Content-Type")).toMatch(/json/);
    expect(res.headers.get("Vary")).toContain("Accept");
    const json = (await res.json()) as { status: string; dataVersion: string };
    expect(json.status).toBe("healthy");
    expect(json.dataVersion).toMatch(/^vPICList_lite_/);
  });

  it("shows the degraded state (503, not cached) when the data assets are unreadable", async () => {
    vi.resetModules();
    const { app: fresh } = await import("../src/index");
    const broken = { ASSETS: { fetch: async () => new Response("", { status: 500 }) } as unknown as Fetcher };
    const res = await fresh.request("/", browser, broken);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const html = await res.text();
    expect(html).toContain("Degraded");
    expect(html).toContain('role="alert"');
  });

  it("escapes everything it prints", () => {
    const html = renderLanding({
      colo: '<img src=x onerror=alert(1)>',
      country: '"><script>alert(2)</script>',
      dataVersion: "<b>v</b>",
      healthy: true,
      stats: null,
      nonce: "n",
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>alert(2)");
    expect(html).not.toContain("<b>v</b>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("ships a client script that compiles and never writes HTML from API data", () => {
    expect(() => new Function(LANDING_JS)).not.toThrow();
    expect(LANDING_JS).not.toContain("innerHTML");
    expect(LANDING_JS).not.toContain("outerHTML");
    expect(LANDING_JS).not.toContain("document.write");
  });

  it.each(SAMPLE_VINS)("the %s quick-pick decodes cleanly to the make it is labelled with", async (label, vin) => {
    const res = await app.request(`/api/v1/vin/${vin}`, undefined, testEnv());
    const { data } = (await res.json()) as { data: { make: string; isCleanDecode: boolean; model: string } };
    expect(data.isCleanDecode).toBe(true);
    expect(`${data.make} ${data.model}`.toLowerCase()).toContain(label.split(" ")[0]?.toLowerCase());
  });
});
