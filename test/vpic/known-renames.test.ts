import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadKnownRenames,
  parseKnownRenames,
  RenameMatcher,
  type KnownRename,
} from "../../scripts/vpic/lib/known-renames";

const wmiEntry: KnownRename = {
  scope: { wmi: "ZAC" },
  field: "Manufacturer",
  local: "FCA ITALY S.P.A.",
  live: "STELLANTIS EUROPE SPA",
  added: "2026-10-16",
  source: "test",
};
const vinEntry: KnownRename = { ...wmiEntry, scope: { vin: "1HD1FS504X9018268" }, local: "A", live: "B" };

describe("known renames data file", () => {
  it("parses and every entry is well formed", () => {
    const entries = loadKnownRenames(resolve(__dirname, "../../data/vpic-known-renames.json"));
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.added).toBe("2026-10-16");
      expect(e.source).toMatch(/vpic\.nhtsa\.dot\.gov/);
    }
  });
});

describe("parseKnownRenames", () => {
  const base = { scope: { wmi: "ZAC" }, field: "Manufacturer", local: "a", live: "b", added: "2026-10-16", source: "s" };
  it("accepts a valid entry", () => {
    expect(parseKnownRenames({ entries: [base] })).toHaveLength(1);
  });
  it.each([
    ["no entries", {}],
    ["both scopes", { entries: [{ ...base, scope: { wmi: "ZAC", vin: "ZACCJABT0FPB71014" } }] }],
    ["no scope", { entries: [{ ...base, scope: {} }] }],
    ["bad wmi", { entries: [{ ...base, scope: { wmi: "ZA" } }] }],
    ["bad vin", { entries: [{ ...base, scope: { vin: "IOQ" } }] }],
    ["bad date", { entries: [{ ...base, added: "16/10/2026" }] }],
    ["empty source", { entries: [{ ...base, source: "" }] }],
    ["identical values", { entries: [{ ...base, live: "a" }] }],
  ])("rejects %s", (_name, json) => {
    expect(() => parseKnownRenames(json)).toThrow();
  });
});

describe("RenameMatcher", () => {
  it("explains a difference only within scope, field and exact values", () => {
    const m = new RenameMatcher([wmiEntry, vinEntry]);
    expect(m.explains("ZACCJABT0FPB71014", "Manufacturer", "FCA ITALY S.P.A.", "STELLANTIS EUROPE SPA")).toBe(wmiEntry);
    expect(m.explains("ZFBCFXBT0GP338271", "Manufacturer", "FCA ITALY S.P.A.", "STELLANTIS EUROPE SPA")).toBeUndefined();
    expect(m.explains("ZACCJABT0FPB71014", "Make", "FCA ITALY S.P.A.", "STELLANTIS EUROPE SPA")).toBeUndefined();
    expect(m.explains("ZACCJABT0FPB71014", "Manufacturer", "FCA ITALY S.P.A.", "OTHER")).toBeUndefined();
    expect(m.explains("1HD1FS504X9018268", "Manufacturer", "A", "B")).toBe(vinEntry);
    expect(m.explains("1HD1FS504X9018269", "Manufacturer", "A", "B")).toBeUndefined();
    expect(m.usedEntries()).toEqual([wmiEntry, vinEntry]);
  });

  it("flags an entry as stale when the dump already has the live value", () => {
    const m = new RenameMatcher([wmiEntry, vinEntry]);
    m.observe("ZACCJABT0FPB71014", "Manufacturer", "STELLANTIS EUROPE SPA", "STELLANTIS EUROPE SPA");
    m.observe("1HD1FS504X9018268", "Manufacturer", "A", "B");
    expect(m.staleEntries()).toEqual([wmiEntry]);
    expect(m.usedEntries()).toEqual([]);
  });

  it("does not flag stale for out-of-scope VINs", () => {
    const m = new RenameMatcher([wmiEntry]);
    m.observe("ZFBCFXBT0GP338271", "Manufacturer", "STELLANTIS EUROPE SPA", "STELLANTIS EUROPE SPA");
    expect(m.staleEntries()).toEqual([]);
  });
});
