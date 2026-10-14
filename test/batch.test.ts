import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { BATCH_JS } from "../src/routes/landing/batch-script";
import { SAMPLE_VINS } from "../src/routes/landing";
import { testEnv } from "./helpers/assets";

const get = (path: string, init?: RequestInit) => app.request(path, init, testEnv());
const post = (data: string) =>
  get("/vehicles/DecodeVINValuesBatch/", { method: "POST", body: new URLSearchParams({ format: "json", data }) });

describe("Batch page (/batch)", () => {
  it("serves the form under the same nonce CSP as the other pages", async () => {
    const res = await get("/batch");
    expect(res.status).toBe(200);
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    const html = await res.text();
    for (const id of ["batch-form", "batch-input", "batch-file", "batch-run", "batch-status", "batch-out", "batch-download"]) {
      expect(html, id).toContain(`id="${id}"`);
    }
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(html).not.toMatch(/\son[a-z]+="/);
  });

  it("is linked from the decoder page", async () => {
    expect(await (await get("/vpic")).text()).toContain('href="/batch"');
  });

  it("ships a script that compiles, never writes HTML from API data, and neutralises CSV formulas", () => {
    expect(() => new Function(BATCH_JS)).not.toThrow();
    expect(BATCH_JS).not.toContain("innerHTML");
    expect(BATCH_JS).not.toContain("document.write");
    expect(BATCH_JS).toContain("[=+\\-@\\t\\r]");
  });

  it("is never rate limited, since it is a page", async () => {
    const limiter = { limit: async () => ({ success: false }) };
    expect((await app.request("/batch", {}, { ...testEnv(), RATE_LIMITER: limiter })).status).toBe(200);
  });
});

describe("The batch endpoint the page calls", () => {
  it("returns one result per entry, in order, honouring a per-entry model year", async () => {
    const vins = SAMPLE_VINS.map(([, vin]) => vin);
    const res = await post(`${vins.join(";")};5YJ3E1EB1NF000001,2022`);
    expect(res.status).toBe(200);
    const { Count, Results } = (await res.json()) as { Count: number; Results: { VIN: string; ErrorCode: string; ModelYear: string }[] };
    expect(Count).toBe(vins.length + 1);
    expect(Results.map((r) => r.VIN)).toEqual([...vins, "5YJ3E1EB1NF000001"]);
    expect(Results.at(-1)?.ModelYear).toBe("2022");
  });

  it("accepts exactly 50 entries and refuses 51", async () => {
    const vin = SAMPLE_VINS[0]?.[1] ?? "";
    expect((await post(Array(50).fill(vin).join(";"))).status).toBe(200);
    expect((await post(Array(51).fill(vin).join(";"))).status).toBe(400);
  });
});
