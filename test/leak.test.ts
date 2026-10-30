import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { app } from "../src/index";
import { leakEmailRouter } from "../src/routes/v1/leak-email";
import { testEnv } from "./helpers/assets";

const TOKEN = "test-token";
const configured = () => ({ ...testEnv(), HIBP_API_KEY: "hibp-test-key", LEAK_API_TOKEN: TOKEN });

// The email route is pending (not mounted in the app), so it is exercised on its own router.
const emailApp = new Hono().route("/api/v1", leakEmailRouter);
const lookup = (body: unknown, env: object = configured(), token = TOKEN) =>
  emailApp.request(
    "/api/v1/leak/email",
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
    env
  );

const breach = (name: string, sensitive = false) => ({
  Name: name, Title: name, Domain: `${name.toLowerCase()}.com`, BreachDate: "2020-01-01", PwnCount: 10,
  DataClasses: ["Email addresses", "Passwords"], IsVerified: true, IsSensitive: sensitive, Description: "<p>x</p>",
});

describe("leak check", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies the password range with padding and never sees more than the prefix", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n", { status: 200 }));
    const res = await app.request("/api/v1/leak/password/range/21bd1", undefined, testEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/text\/plain/);
    expect(await res.text()).toContain(":1");
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://api.pwnedpasswords.com/range/21BD1");
    expect((init?.headers as Record<string, string>)["Add-Padding"]).toBe("true");
  });

  it("rejects anything but a 5-hex prefix", async () => {
    for (const bad of ["21BD", "21BD1A", "GGGGG"]) {
      expect((await app.request(`/api/v1/leak/password/range/${bad}`, undefined, testEnv())).status).toBe(400);
    }
  });

  it("does not expose the pending email lookup yet", async () => {
    const res = await app.request("/api/v1/leak/email", { method: "POST", body: "{}" }, configured());
    expect(res.status).toBe(404);
  });

  it("answers 503 for email lookups until both secrets are set, before calling anyone", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect((await lookup({ email: "a@b.co" }, testEnv())).status).toBe(503);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires the bearer token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect((await lookup({ email: "a@b.co" }, configured(), "wrong")).status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("validates the email", async () => {
    expect((await lookup({ email: "not-an-email" })).status).toBe(400);
  });

  it("reports a clean email on HIBP 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    const res = await lookup({ email: "clean@example.com" });
    const json = (await res.json()) as { data: { breached: boolean }; source: { url: string } };
    expect(res.status).toBe(200);
    expect(json.data.breached).toBe(false);
    expect(json.source.url).toBe("https://haveibeenpwned.com");
  });

  it("sends the HIBP key, normalizes the email and drops sensitive breaches", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([breach("Adobe"), breach("Hidden", true)]), { status: 200 })
    );
    const res = await lookup({ email: " Test+x@Example.com " });
    const json = (await res.json()) as { data: { breachCount: number; breaches: { name: string }[] } };
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(json.data.breachCount).toBe(1);
    expect(json.data.breaches.map((b) => b.name)).toEqual(["Adobe"]);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toBe("https://haveibeenpwned.com/api/v3/breachedaccount/test%2Bx%40example.com?truncateResponse=false");
    expect((init?.headers as Record<string, string>)["hibp-api-key"]).toBe("hibp-test-key");
  });

  it("passes HIBP rate limiting through with Retry-After", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 429, headers: { "retry-after": "3" } }));
    const res = await lookup({ email: "a@b.co" });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("3");
  });

  it("does not put the email in errors when HIBP is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed: https://haveibeenpwned.com/.../a%40b.co"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await lookup({ email: "a@b.co" });
    expect(res.status).toBe(500);
    const logged = log.mock.calls.flat().map((a) => (a instanceof Error ? `${a.message} ${a.stack}` : String(a))).join("\n");
    expect(logged).toContain("unreachable");
    expect(logged).not.toContain("a%40b.co");
    expect(logged).not.toContain("a@b.co");
  });
});
