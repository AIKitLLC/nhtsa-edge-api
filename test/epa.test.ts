import { mkdtempSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildShards } from "../scripts/epa/build-assets";
import { parseCsv } from "../scripts/epa/csv";
import { COLUMNS, selectColumns } from "../scripts/epa/ingest";
import { app } from "../src/index";
import { ASSETS_DIR, fsAssets, testEnv } from "./helpers/assets";

// The header and first record of FuelEconomy.gov's vehicles.csv as served on 2026-10-15
const HEADER =
  "barrels08,barrelsA08,charge120,charge240,city08,city08U,cityA08,cityA08U,cityCD,cityE,cityUF,co2,co2A,co2TailpipeAGpm,co2TailpipeGpm,comb08,comb08U,combA08,combA08U,combE,combinedCD,combinedUF,cylinders,displ,drive,engId,eng_dscr,feScore,fuelCost08,fuelCostA08,fuelType,fuelType1,ghgScore,ghgScoreA,highway08,highway08U,highwayA08,highwayA08U,highwayCD,highwayE,highwayUF,hlv,hpv,id,lv2,lv4,make,model,mpgData,phevBlended,pv2,pv4,range,rangeCity,rangeCityA,rangeHwy,rangeHwyA,trany,UCity,UCityA,UHighway,UHighwayA,VClass,year,youSaveSpend,baseModel,guzzler,trans_dscr,tCharger,sCharger,atvType,fuelType2,rangeA,evMotor,mfrCode,c240Dscr,charge240b,c240bDscr,createdOn,modifiedOn,startStop,phevCity,phevHwy,phevComb";
const ROW =
  "14.167142857142858,0.0,0.0,0.0,19,0.0,0,0.0,0.0,0.0,0.0,-1,-1,0.0,423.1904761904762,21,0.0,0,0.0,0.0,0.0,0.0,4,2.0,Rear-Wheel Drive,9011,(FFS),-1,3200,0,Regular,Regular Gasoline,-1,-1,25,0.0,0,0.0,0.0,0.0,0.0,0,0,1,0,0,Alfa Romeo,Spider Veloce 2000,Y,false,0,0,0,0.0,0.0,0.0,0.0,Manual 5-spd,23.3333,0.0,35.0,0.0,Two Seaters,1985,-4000,Spider,,,,,,,,,,,0.0,,Tue Jan 01 00:00:00 EST 2013,Tue Jan 01 00:00:00 EST 2013,,0,0,0";

/** The real row with some fields replaced, by column name. */
function record(overrides: Record<string, string>): string {
  const names = HEADER.split(",");
  const values = ROW.split(",");
  for (const [k, v] of Object.entries(overrides)) values[names.indexOf(k)] = v;
  return values.join(",");
}

const CSV = [
  HEADER,
  record({ id: "7", year: "2022", make: "Honda", model: "Accord", comb08: "32" }),
  record({ id: "9", year: "2022", make: "Honda", model: "Accord Hybrid", comb08: "48" }),
  record({ id: "3", year: "2022", make: "Mercedes-Benz", model: '"C 300, 4MATIC"' }),
].join("\r\n");

describe("parseCsv", () => {
  it("reads quoted commas, doubled quotes, line breaks and CRLF", () => {
    expect(parseCsv('a,"b,c","d ""e"""\r\nx,"y\nz",\n')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["x", "y\nz", ""],
    ]);
  });
});

describe("EPA ingestion", () => {
  it("keeps the served columns, in order, sorted by year, make, model, id", () => {
    const [header, ...rows] = selectColumns(CSV);
    expect(header).toEqual([...COLUMNS]);
    expect(rows.map((r) => r.slice(0, 4))).toEqual([
      ["7", "2022", "Honda", "Accord"],
      ["9", "2022", "Honda", "Accord Hybrid"],
      ["3", "2022", "Mercedes-Benz", "C 300, 4MATIC"],
    ]);
  });

  it("fails when a column we serve disappears from the source", () => {
    expect(() => selectColumns(CSV.replace("comb08,", "combined,"))).toThrow(/comb08/);
  });
});

describe("EPA assets and endpoint", () => {
  const root = mkdtempSync(join(tmpdir(), "epa-test-"));
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const shards = buildShards(selectColumns(CSV), "2026-09-29");
  for (const [path, shard] of shards) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), JSON.stringify(shard));
  }
  const env = { ASSETS: fsAssets(root), ALLOW_NO_RATE_LIMIT: "true", ENVIRONMENT: "test" };
  const get = (q: string) => app.request(`/api/v1/fuel-economy${q}`, {}, env);

  it("writes one shard per year and make, with numbers as numbers and blanks omitted", () => {
    expect([...shards.keys()].sort()).toEqual(["epa/2022/honda.json", "epa/2022/mercedes-benz.json"]);
    const accord = shards.get("epa/2022/honda.json")?.vehicles[0];
    expect(accord).toMatchObject({ id: 7, year: 2022, make: "Honda", comb08: 32, drive: "Rear-Wheel Drive" });
    expect(accord).not.toHaveProperty("evMotor");
  });

  it("answers by year and make, ignoring case and punctuation", async () => {
    const res = await get("?year=2022&make=HONDA");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { count: number; dataVersion: string; source: string };
    expect(json).toMatchObject({ count: 2, dataVersion: "epa-2026-09-29", source: "LOCAL_EPA" });
    expect(((await (await get("?year=2022&make=mercedes%20benz")).json()) as { count: number }).count).toBe(1);
  });

  it("filters by model name containing the text", async () => {
    const json = (await (await get("?year=2022&make=Honda&model=hybrid")).json()) as { data: { id: number }[] };
    expect(json.data.map((v) => v.id)).toEqual([9]);
  });

  it("is 400 without year and make, and 404 when nothing matches", async () => {
    expect((await get("")).status).toBe(400);
    expect((await get("?year=22&make=Honda")).status).toBe(400);
    expect((await get("?year=2022&make=Honda&model=nothing")).status).toBe(404);
    expect((await get("?year=1900&make=Honda")).status).toBe(404);
    expect((await get("?year=2022&make=!!!")).status).toBe(404);
  });
});

describe("EPA endpoint on the built data", () => {
  it("serves electric-vehicle ranges for a real model year, make and model", async () => {
    const res = await app.request("/api/v1/fuel-economy?year=2022&make=Tesla&model=Model%203", {}, testEnv());
    expect(res.status).toBe(200);
    const { count, data } = (await res.json()) as { count: number; data: { atvType: string; range: number; comb08: number }[] };
    expect(count).toBeGreaterThan(0);
    for (const v of data) expect(v).toMatchObject({ atvType: "EV", range: expect.any(Number) });
    expect(Math.min(...data.map((v) => v.range))).toBeGreaterThan(150);
  });

  it("keeps every shard small enough to read within the Worker's CPU budget", () => {
    const dir = join(ASSETS_DIR, "epa");
    const sizes = readdirSync(dir).flatMap((y) => readdirSync(join(dir, y)).map((f) => statSync(join(dir, y, f)).size));
    expect(sizes.length).toBeGreaterThan(1000);
    expect(Math.max(...sizes)).toBeLessThan(250_000);
  });
});
