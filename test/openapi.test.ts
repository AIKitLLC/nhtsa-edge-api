import { describe, it, expect } from "vitest";
import { app } from "../src/index";
import { OPENAPI, OPENAPI_EXAMPLE_VIN } from "../src/routes/openapi/spec";
import { testEnv } from "./helpers/assets";

const get = (path: string, init?: RequestInit) => app.request(path, init, testEnv());

const operations = Object.entries(OPENAPI.paths).flatMap(([path, methods]) =>
  Object.keys(methods).map((verb) => ({ path, verb: verb.toUpperCase() }))
);

describe("OpenAPI document", () => {
  it("is served as JSON, with CORS, and is OpenAPI 3.1", async () => {
    const res = await get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/json/);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const doc = (await res.json()) as { openapi: string; paths: object };
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toEqual(Object.keys(OPENAPI.paths));
  });

  it.each(operations)("$verb $path is a real route", async ({ path, verb }) => {
    // Short path values and empty bodies keep every call offline and fast
    const url = path.replace("{vin}", "ZZZ");
    const init = verb === "POST" ? { method: "POST", body: new URLSearchParams({ format: "json", data: "" }) } : undefined;
    const res = await get(url, init);
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };
    expect(body.error?.code, `${verb} ${url} answered ${res.status}`).not.toBe("ROUTE_NOT_FOUND");
  });

  it("documents every field the decode response really has, and the documented status codes", async () => {
    const res = await get(`/api/v1/vin/${OPENAPI_EXAMPLE_VIN}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Vpic-Data-Version")).toBeTruthy();
    const json = (await res.json()) as { data: Record<string, unknown> } & Record<string, unknown>;

    const schema = OPENAPI.components.schemas.DecodeResponse;
    for (const key of Object.keys(schema.properties)) expect(json, `response.${key}`).toHaveProperty(key);
    for (const key of Object.keys(schema.properties.data.properties)) expect(json.data, `data.${key}`).toHaveProperty(key);
    expect(json.data["isCleanDecode"]).toBe(true);

    expect((await get("/api/v1/vin/!!")).status).toBe(400);
    expect((await get("/api/v1/models")).status).toBe(400);
    expect((await get("/api/v1/models?make=zzzznotamake")).status).toBe(404);
  });

  it("documents the vPIC envelope, and the batch example from the spec decodes", async () => {
    const res = await get(`/vehicles/DecodeVinValues/${OPENAPI_EXAMPLE_VIN}?format=json`);
    const env = (await res.json()) as Record<string, unknown>;
    for (const key of Object.keys(OPENAPI.components.schemas.VpicEnvelope.properties)) expect(env).toHaveProperty(key);

    const example = OPENAPI.paths["/vehicles/DecodeVINValuesBatch/"].post.requestBody.content["application/x-www-form-urlencoded"].schema.properties.data.example;
    const batch = await get("/vehicles/DecodeVINValuesBatch/", { method: "POST", body: new URLSearchParams({ format: "json", data: example }) });
    expect(batch.status).toBe(200);
    expect(((await batch.json()) as { Count: number }).Count).toBe(example.split(";").length);
  });
});

describe("/docs and /llms.txt", () => {
  it("lists every operation of the document", async () => {
    const res = await get("/docs", { headers: { Accept: "text/html" } });
    expect(res.status).toBe(200);
    const html = await res.text();
    for (const { path, verb } of operations) {
      expect(html, `${verb} ${path}`).toContain(path.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`).replace(/&#123;/g, "{"));
    }
    expect(html).toContain("/openapi.json");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
  });

  it("gives agents a plain-text summary with a working example", async () => {
    const res = await get("/llms.txt");
    expect(res.headers.get("Content-Type")).toMatch(/text\/plain/);
    const text = await res.text();
    expect(text).toMatch(/^# AI Kit Data/);
    expect(text).toContain("/openapi.json");
    expect(text).toContain(`/api/v1/vin/${OPENAPI_EXAMPLE_VIN}`);
  });
});
