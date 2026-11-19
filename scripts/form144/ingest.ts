#!/usr/bin/env bun
/**
 * Ingests SEC Form 144 insider sale notices from EDGAR into data/form144 (git-tracked).
 *
 * For each day in the range: downloads the daily form index, keeps the 144 and
 * 144/A entries (deduplicated by accession number — the index lists a filing once
 * per filer), downloads each filing's .txt submission, parses the XML block and
 * writes data/form144/days/<YYYY-MM-DD>.json. A day whose file already exists is
 * skipped, so re-running is idempotent and an interrupted run resumes where it
 * stopped. --force re-downloads every day in range.
 *
 * SEC fair access: a declared User-Agent and at most ~7 requests/second.
 *
 * Usage: bun scripts/form144/ingest.ts [--from=2026-10-20] [--to=2026-11-18] [--days=30] [--force] [--out=data/form144]
 * Source: https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent (EDGAR full-text/daily index, public domain, U.S. Government work)
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Form144Day, Form144Manifest, Form144Security, SaleNotice } from "../../src/form144/store";

export const USER_AGENT = "AIKitLLC data.ai-kit.net tuannx87@gmail.com";
export const EDGAR = "https://www.sec.gov";
const TICKERS_URL = `${EDGAR}/files/company_tickers.json`;
const MIN_INTERVAL_MS = 140; // ~7 requests/second, under SEC's 10/second fair-access ceiling
const CONCURRENCY = 6;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Global request pacing shared by every worker: request starts are at least MIN_INTERVAL_MS apart. */
let nextSlot = 0;
async function pacedFetch(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const wait = Math.max(0, nextSlot - Date.now());
    nextSlot = Math.max(Date.now(), nextSlot) + MIN_INTERVAL_MS;
    if (wait > 0) await sleep(wait);
    try {
      const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
      if (res.status === 404 || res.ok) return res;
      if (attempt >= 3) return res;
    } catch (err) {
      if (attempt >= 3) throw err;
    }
    await sleep(1000 * attempt);
  }
}

// ---------- daily index ----------

export interface IndexEntry {
  readonly formType: string;
  readonly cik: string;
  /** Filing date as ISO (YYYY-MM-DD). */
  readonly date: string;
  readonly fileName: string;
  readonly accession: string;
}

const INDEX_LINE = /^(\S+)\s+(.+?)\s+(\d{1,10})\s+(\d{8})\s+(edgar\/\S+)\s*$/;

/** The 144 and 144/A entries of a daily form index, deduplicated by accession number. */
export function parseIndex(text: string): IndexEntry[] {
  const byAccession = new Map<string, IndexEntry>();
  for (const line of text.split("\n")) {
    const m = INDEX_LINE.exec(line);
    if (!m || (m[1] !== "144" && m[1] !== "144/A")) continue;
    const fileName = m[5] as string;
    const accession = fileName.split("/").pop()?.replace(/\.txt$/, "") ?? "";
    if (!accession || byAccession.has(accession)) continue;
    const d = m[4] as string;
    byAccession.set(accession, {
      formType: m[1],
      cik: m[3] as string,
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      fileName,
      accession,
    });
  }
  return [...byAccession.values()];
}

export const indexUrl = (isoDate: string): string => {
  const [y, m] = isoDate.split("-");
  const qtr = Math.floor((Number(m) - 1) / 3) + 1;
  return `${EDGAR}/Archives/edgar/daily-index/${y}/QTR${qtr}/form.${isoDate.replaceAll("-", "")}.idx`;
};

// ---------- filing XML ----------

const unescapeXml = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** Inner text of the first <name>...</name> in block, trimmed; null when absent or empty. */
function tagText(block: string, name: string): string | null {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block);
  const text = m ? unescapeXml(m[1] ?? "").trim() : "";
  return text === "" ? null : text;
}

/** Inner text of every <name>...</name> in block. */
function allTagTexts(block: string, name: string): string[] {
  const out: string[] = [];
  for (const m of block.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, "g"))) {
    const text = unescapeXml(m[1] ?? "").trim();
    if (text !== "") out.push(text);
  }
  return out;
}

/** Every <name>...</name> block (tags included) in xml. */
function blocks(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>[\\s\\S]*?</${name}>`, "g"))].map((m) => m[0]);
}

const num = (v: string | null): number | null => {
  if (v === null) return null;
  const n = Number(v.replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** EDGAR dates are MM/DD/YYYY; returns ISO (YYYY-MM-DD) or null. */
export function usDateToIso(v: string | null): string | null {
  if (v === null) return null;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v.trim());
  if (!m) return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
  return `${m[3]}-${(m[1] as string).padStart(2, "0")}-${(m[2] as string).padStart(2, "0")}`;
}

/**
 * The <edgarSubmission> XML document inside a filing's .txt submission; null when there is none.
 * Some filers prefix every tag with a namespace (own:, com:); prefixes are stripped so the
 * parser sees one shape.
 */
export function extractXml(txt: string): string | null {
  const open = /<(?:[A-Za-z_][\w.-]*:)?edgarSubmission[\s>]/.exec(txt);
  if (!open) return null;
  const close = /<\/(?:[A-Za-z_][\w.-]*:)?edgarSubmission>/.exec(txt.slice(open.index));
  if (!close) return null;
  const raw = txt.slice(open.index, open.index + close.index + close[0].length);
  return raw.replace(/<(\/?)[A-Za-z_][\w.-]*:/g, "<$1");
}

export interface FilingMeta {
  readonly accession: string;
  readonly formType: string;
  /** ISO filing date, from the daily index. */
  readonly filingDate: string;
}

/** Parses one filing's submission text into a sale notice; null when it has no XML block. */
export function parseNotice(txt: string, meta: FilingMeta, tickers: ReadonlyMap<number, string>): SaleNotice | null {
  const xml = extractXml(txt);
  if (xml === null) return null;
  const issuer = blocks(xml, "issuerInfo")[0] ?? "";
  const cikRaw = tagText(issuer, "issuerCik");
  const cik = cikRaw === null ? "" : String(Number(cikRaw));
  const signature = blocks(xml, "noticeSignature")[0] ?? "";
  const securities: Form144Security[] = blocks(xml, "securitiesInformation").map((block) => {
    const broker = blocks(block, "brokerOrMarketmakerDetails")[0] ?? "";
    return {
      security_title: tagText(block, "securitiesClassTitle"),
      shares_to_sell: num(tagText(block, "noOfUnitsSold")),
      market_value: num(tagText(block, "aggregateMarketValue")),
      shares_outstanding: num(tagText(block, "noOfUnitsOutstanding")),
      approximate_sale_date: usDateToIso(tagText(block, "approxSaleDate")),
      exchange: tagText(block, "securitiesExchangeName"),
      broker: tagText(broker, "name"),
    };
  });
  return {
    ticker: tickers.get(Number(cik)) ?? null,
    cik,
    issuer: tagText(issuer, "issuerName") ?? "",
    name: tagText(issuer, "nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold") ?? "",
    relationships: allTagTexts(issuer, "relationshipToIssuer"),
    form_type: tagText(xml, "submissionType") ?? meta.formType,
    filing_date: meta.filingDate,
    notice_date: usDateToIso(tagText(signature, "noticeDate")),
    accession_number: meta.accession,
    replaces_accession_number: tagText(xml, "previousAccessionNumber"),
    plan_adoption_dates: allTagTexts(signature, "planAdoptionDate")
      .map(usDateToIso)
      .filter((d): d is string => d !== null),
    securities,
  };
}

/** CIK (numeric) to ticker from SEC's company_tickers.json. First ticker wins for multi-class issuers. */
export function parseTickers(json: unknown): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of Object.values(json as Record<string, { cik_str?: number; ticker?: string }>)) {
    if (typeof row?.cik_str === "number" && row.ticker && !map.has(row.cik_str)) map.set(row.cik_str, row.ticker);
  }
  return map;
}

// ---------- ingest ----------

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function writeAtomic(path: string, text: string): void {
  writeFileSync(`${path}.tmp`, text);
  renameSync(`${path}.tmp`, path);
}

async function ingestDay(date: string, outDir: string, tickers: ReadonlyMap<number, string>, force: boolean): Promise<void> {
  const dayPath = join(outDir, "days", `${date}.json`);
  if (!force && existsSync(dayPath)) {
    console.log(`form144: ${date} already ingested, skipping`);
    return;
  }
  const idxRes = await pacedFetch(indexUrl(date));
  // SEC Archives answers 403 (not 404) for objects that do not exist, which is what a
  // weekend or holiday index is. Retry once after a pause so a transient block is not
  // mistaken for a missing day.
  if (idxRes.status === 404 || idxRes.status === 403) {
    if (idxRes.status === 403) await sleep(5000);
    const retry = await pacedFetch(indexUrl(date));
    if (retry.status === 404 || retry.status === 403) {
      console.log(`form144: ${date} has no daily index (HTTP ${retry.status}; weekend or holiday), skipping`);
      return;
    }
    if (!retry.ok) throw new Error(`index for ${date}: HTTP ${retry.status}`);
    return ingestEntries(date, outDir, tickers, parseIndex(await retry.text()));
  }
  if (!idxRes.ok) throw new Error(`index for ${date}: HTTP ${idxRes.status}`);
  return ingestEntries(date, outDir, tickers, parseIndex(await idxRes.text()));
}

async function ingestEntries(date: string, outDir: string, tickers: ReadonlyMap<number, string>, entries: readonly IndexEntry[]): Promise<void> {
  const dayPath = join(outDir, "days", `${date}.json`);
  const notices: SaleNotice[] = [];
  const failed: string[] = [];
  let cursor = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const entry = entries[cursor++];
      if (!entry) return;
      try {
        const res = await pacedFetch(`${EDGAR}/Archives/${entry.fileName}`);
        const notice = res.ok
          ? parseNotice(await res.text(), { accession: entry.accession, formType: entry.formType, filingDate: entry.date }, tickers)
          : null;
        if (notice) notices.push(notice);
        else failed.push(entry.accession);
      } catch {
        failed.push(entry.accession);
      }
    }
  });
  await Promise.all(workers);

  notices.sort((a, b) => a.accession_number.localeCompare(b.accession_number));
  const day: Form144Day = { date, indexCount: entries.length, failed: failed.sort(), notices };
  mkdirSync(join(outDir, "days"), { recursive: true });
  writeAtomic(dayPath, JSON.stringify(day, null, 1) + "\n");
  console.log(`form144: ${date}: ${notices.length}/${entries.length} notices (${failed.length} without parseable XML)`);
}

/** Rebuilds manifest.json from the day files on disk, so it always matches what is committed. */
export function buildManifest(outDir: string): Form144Manifest {
  const daysDir = join(outDir, "days");
  const days: Form144Manifest["days"][number][] = [];
  let totalRecords = 0;
  if (existsSync(daysDir)) {
    for (const file of readdirSync(daysDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()) {
      const day = JSON.parse(readFileSync(join(daysDir, file), "utf-8")) as Form144Day;
      days.push({ date: day.date, count: day.notices.length, indexCount: day.indexCount, failed: day.failed.length });
      totalRecords += day.notices.length;
    }
  }
  const manifest: Form144Manifest = {
    source: "SEC EDGAR daily form index (Form 144)",
    generatedAt: new Date().toISOString(),
    coverage: { from: days[0]?.date ?? "", to: days[days.length - 1]?.date ?? "" },
    totalRecords,
    days,
  };
  writeAtomic(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (import.meta.main) {
  const arg = (name: string, fallback: string): string =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const root = resolve(import.meta.dirname ?? ".", "../..");
  const outDir = resolve(root, arg("out", "data/form144"));
  const to = arg("to", addDays(new Date().toISOString().slice(0, 10), -1));
  const from = arg("from", addDays(to, -(Number(arg("days", "30")) - 1)));
  const force = process.argv.includes("--force");

  const tickersRes = await pacedFetch(TICKERS_URL);
  if (!tickersRes.ok) throw new Error(`company_tickers.json: HTTP ${tickersRes.status}`);
  const tickers = parseTickers(await tickersRes.json());
  console.log(`form144: ${tickers.size} CIK to ticker mappings; range ${from} to ${to}`);

  for (let date = from; date <= to; date = addDays(date, 1)) {
    await ingestDay(date, outDir, tickers, force);
  }
  const manifest = buildManifest(outDir);
  console.log(`form144: manifest: ${manifest.totalRecords} records, coverage ${manifest.coverage.from} to ${manifest.coverage.to}`);
}
