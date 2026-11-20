import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseIndex, parseNotice, usDateToIso } from "../scripts/form144/ingest";
import { copyAssets } from "../scripts/form144/build-assets";
import type { Form144Day, Form144Manifest, SaleNotice } from "../src/form144/store";
import { app } from "../src/index";
import { fsAssets, testEnv } from "./helpers/assets";

// A real filing's XML (Akamai, filed 2026-11-18), trimmed to the blocks the parser reads.
const PLAIN = `<SEC-DOCUMENT>0001921094-26-001218.txt : 20261118
<DOCUMENT><TYPE>144<TEXT>
<XML><?xml version="1.0" encoding="UTF-8"?><edgarSubmission xmlns="http://www.sec.gov/edgar/ownership" xmlns:com="http://www.sec.gov/edgar/common">
<headerData><submissionType>144</submissionType></headerData>
<formData><issuerInfo><issuerCik>0001086222</issuerCik><issuerName>AKAMAI TECHNOLOGIES INC</issuerName>
<nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>Joseph Paul C</nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>
<relationshipsToIssuer><relationshipToIssuer>Officer</relationshipToIssuer></relationshipsToIssuer></issuerInfo>
<securitiesInformation><securitiesClassTitle>Common</securitiesClassTitle>
<brokerOrMarketmakerDetails><name>Charles Schwab &amp; Co., Inc.</name></brokerOrMarketmakerDetails>
<noOfUnitsSold>6200</noOfUnitsSold><aggregateMarketValue>529582.00</aggregateMarketValue>
<noOfUnitsOutstanding>144229175</noOfUnitsOutstanding><approxSaleDate>11/18/2026</approxSaleDate>
<securitiesExchangeName>NASDAQ</securitiesExchangeName></securitiesInformation>
<noticeSignature><noticeDate>11/18/2026</noticeDate><planAdoptionDates><planAdoptionDate>03/04/2026</planAdoptionDate></planAdoptionDates></noticeSignature>
</formData></edgarSubmission></XML></TEXT></DOCUMENT>`;

// The same filing shape with a namespace prefix on every tag, as some filers submit it
// (Interface Inc, filed 2026-10-20).
const PREFIXED = `<SEC-DOCUMENT>0001628280-26-066481.txt : 20261020
<DOCUMENT><TYPE>144<TEXT>
<XML><?xml version="1.0" encoding="UTF-8"?><own:edgarSubmission xmlns:own="http://www.sec.gov/edgar/ownership" xmlns:com="http://www.sec.gov/edgar/common">
<own:headerData><own:submissionType>144</own:submissionType></own:headerData>
<own:formData><own:issuerInfo><own:issuerCik>0000715787</own:issuerCik><own:issuerName>Interface Inc.</own:issuerName>
<own:nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>Daniel Hendrix</own:nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold>
<own:relationshipsToIssuer><own:relationshipToIssuer>Director</own:relationshipToIssuer></own:relationshipsToIssuer></own:issuerInfo>
<own:securitiesInformation><own:securitiesClassTitle>common</own:securitiesClassTitle>
<own:brokerOrMarketmakerDetails><own:name>Merrill Lynch</own:name></own:brokerOrMarketmakerDetails>
<own:noOfUnitsSold>4000</own:noOfUnitsSold><own:aggregateMarketValue>141544.82</own:aggregateMarketValue>
<own:noOfUnitsOutstanding>57800460</own:noOfUnitsOutstanding><own:approxSaleDate>10/20/2026</own:approxSaleDate>
<own:securitiesExchangeName>Nasdaq</own:securitiesExchangeName></own:securitiesInformation>
<own:noticeSignature><own:noticeDate>10/20/2026</own:noticeDate><own:planAdoptionDates><own:planAdoptionDate>06/03/2026</own:planAdoptionDate></own:planAdoptionDates></own:noticeSignature>
</own:formData></own:edgarSubmission></XML></TEXT></DOCUMENT>`;

const INDEX = [
  "144              AKAMAI TECHNOLOGIES INC                                       1086222     20261118    edgar/data/1086222/0001921094-26-001218.txt",
  "144              Joseph Paul C                                                 1845574     20261118    edgar/data/1845574/0001921094-26-001218.txt",
  "144/A            H World Group Ltd                                             1483994     20261118    edgar/data/1483994/0001104659-26-129535.txt",
  "4                SOME OTHER FORM                                               1234567     20261118    edgar/data/1234567/0001234567-26-000001.txt",
].join("\n");

describe("Form 144 index parsing", () => {
  it("keeps 144 and 144/A, deduplicated by accession (the index lists each filing once per filer)", () => {
    const entries = parseIndex(INDEX);
    expect(entries.map((e) => e.accession)).toEqual(["0001921094-26-001218", "0001104659-26-129535"]);
    expect(entries[1]).toMatchObject({ formType: "144/A", date: "2026-11-18" });
  });
});

describe("Form 144 filing parsing", () => {
  const tickers = new Map([[1086222, "AKAM"]]);

  it("parses the plain shape, resolving the ticker by issuer CIK", () => {
    const n = parseNotice(PLAIN, { accession: "0001921094-26-001218", formType: "144", filingDate: "2026-11-18" }, tickers);
    expect(n).toMatchObject({
      ticker: "AKAM",
      cik: "1086222",
      issuer: "AKAMAI TECHNOLOGIES INC",
      name: "Joseph Paul C",
      relationships: ["Officer"],
      form_type: "144",
      notice_date: "2026-11-18",
      replaces_accession_number: null,
      plan_adoption_dates: ["2026-03-04"],
    });
    expect(n?.securities).toEqual([
      {
        security_title: "Common",
        shares_to_sell: 6200,
        market_value: 529582,
        shares_outstanding: 144229175,
        approximate_sale_date: "2026-11-18",
        exchange: "NASDAQ",
        broker: "Charles Schwab & Co., Inc.",
      },
    ]);
  });

  it("parses the namespace-prefixed shape identically", () => {
    const n = parseNotice(PREFIXED, { accession: "0001628280-26-066481", formType: "144", filingDate: "2026-10-20" }, tickers);
    expect(n).toMatchObject({ cik: "715787", issuer: "Interface Inc.", name: "Daniel Hendrix", relationships: ["Director"], ticker: null });
    expect(n?.securities[0]).toMatchObject({ shares_to_sell: 4000, market_value: 141544.82, broker: "Merrill Lynch" });
  });

  it("returns null when the submission has no XML block", () => {
    expect(parseNotice("no xml here", { accession: "x", formType: "144", filingDate: "2026-11-18" }, tickers)).toBeNull();
  });

  it("converts EDGAR dates and rejects other shapes", () => {
    expect(usDateToIso("3/4/2026")).toBe("2026-03-04");
    expect(usDateToIso("2026-03-04")).toBe("2026-03-04");
    expect(usDateToIso("March 4, 2026")).toBeNull();
    expect(usDateToIso(null)).toBeNull();
  });
});

const notice = (over: Partial<SaleNotice>): SaleNotice => ({
  ticker: "AKAM",
  cik: "1086222",
  issuer: "AKAMAI TECHNOLOGIES INC",
  name: "Seller",
  relationships: ["Officer"],
  form_type: "144",
  filing_date: "2026-11-18",
  notice_date: "2026-11-18",
  accession_number: "0001",
  replaces_accession_number: null,
  plan_adoption_dates: [],
  securities: [],
  ...over,
});

describe("Form 144 assets and endpoint", () => {
  const dataRoot = mkdtempSync(join(tmpdir(), "form144-data-"));
  const assetsRoot = mkdtempSync(join(tmpdir(), "form144-assets-"));
  afterAll(() => {
    rmSync(dataRoot, { recursive: true, force: true });
    rmSync(assetsRoot, { recursive: true, force: true });
  });

  const day = (date: string, notices: SaleNotice[]): Form144Day => ({ date, indexCount: notices.length, failed: [], notices });
  const days = [
    day("2026-11-17", [notice({ accession_number: "0002", filing_date: "2026-11-17", ticker: "PLTR", cik: "1321655", issuer: "Palantir" })]),
    day("2026-11-18", [notice({ accession_number: "0001" }), notice({ accession_number: "0003", name: "Other", ticker: null, cik: "999" })]),
  ];
  mkdirSync(join(dataRoot, "days"), { recursive: true });
  for (const d of days) writeFileSync(join(dataRoot, "days", `${d.date}.json`), JSON.stringify(d));
  const manifest: Form144Manifest = {
    source: "SEC EDGAR daily form index (Form 144)",
    generatedAt: "2026-11-19T00:00:00.000Z",
    coverage: { from: "2026-11-17", to: "2026-11-18" },
    totalRecords: 3,
    days: days.map((d) => ({ date: d.date, count: d.notices.length, indexCount: d.indexCount, failed: 0 })),
  };
  writeFileSync(join(dataRoot, "manifest.json"), JSON.stringify(manifest));
  const copied = copyAssets(dataRoot, assetsRoot);

  it("build-assets copies the manifest and one file per day", () => {
    expect(copied).toBe(3);
  });

  const env = { ASSETS: fsAssets(assetsRoot), ALLOW_NO_RATE_LIMIT: "true", ENVIRONMENT: "test" };
  const get = (q: string) => app.request(`/api/v1/form144${q}`, {}, env);

  it("answers newest first with the envelope fields", async () => {
    const res = await get("");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { count: number; total: number; source: string; dataVersion: string; sale_notices: SaleNotice[] };
    expect(json).toMatchObject({ count: 3, total: 3, source: "SEC_EDGAR", dataVersion: "form144-2026-11-18" });
    expect(json.sale_notices.map((n) => n.accession_number)).toEqual(["0001", "0003", "0002"]);
  });

  it("filters by ticker, cik, date range and limit", async () => {
    const byTicker = (await (await get("?ticker=pltr")).json()) as { sale_notices: SaleNotice[] };
    expect(byTicker.sale_notices.map((n) => n.issuer)).toEqual(["Palantir"]);
    const byCik = (await (await get("?cik=0001086222")).json()) as { total: number };
    expect(byCik.total).toBe(1);
    const byRange = (await (await get("?from=2026-11-18&to=2026-11-18")).json()) as { total: number };
    expect(byRange.total).toBe(2);
    const limited = (await (await get("?limit=2")).json()) as { count: number; total: number };
    expect(limited).toMatchObject({ count: 2, total: 3 });
  });

  it("is 400 on invalid parameters", async () => {
    expect((await get("?cik=abc")).status).toBe(400);
    expect((await get("?from=18-11-2026")).status).toBe(400);
    expect((await get("?from=2026-11-18&to=2026-11-17")).status).toBe(400);
    expect((await get("?limit=0")).status).toBe(400);
  });
});

describe("Form 144 endpoint on the built data", () => {
  it("serves the real ingested cache", async () => {
    const res = await app.request("/api/v1/form144?limit=1", {}, testEnv());
    expect(res.status).toBe(200);
    const json = (await res.json()) as { total: number; sale_notices: SaleNotice[] };
    expect(json.total).toBeGreaterThan(1000);
    expect(json.sale_notices[0]?.form_type).toMatch(/^144/);
  });
});
