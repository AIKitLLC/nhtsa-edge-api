# SEC Form 144 — insider sale notices

Form 144 is the notice an insider (an officer, director, or control person) must
file with the U.S. Securities and Exchange Commission (SEC) **before** selling
restricted or control securities under Rule 144. It states who intends to sell,
how many shares, their aggregate market value, and the approximate sale date.

That makes Form 144 a leading indicator: the notice is filed before (or
concurrently with) the sale, while the better-known Form 4 reports the completed
trade afterwards. A cluster of Form 144 filings at one issuer means insiders
have declared an intention to sell; it does not prove the sales happened.

Source: SEC EDGAR, the SEC's public filing system. The filings are U.S.
Government works and are public domain. Nothing here is scraped from a paid
reseller: the same data is sold by API vendors, and it all comes from EDGAR.

## Endpoint

```
GET /api/v1/form144[?ticker=AAPL][&cik=320193][&from=2026-11-01][&to=2026-11-18][&limit=50]
```

Served from a cache bundled in the Worker (built from `data/form144`), never
proxied to EDGAR at request time. Responses are cached at the edge for a day
(`Cache-Control: public, max-age=86400, stale-while-revalidate=604800`).

| Parameter | Meaning |
| :-- | :-- |
| `ticker` | Issuer ticker (case-insensitive), resolved from the issuer CIK with the SEC's own mapping (below) |
| `cik` | Issuer CIK, leading zeros optional |
| `from`, `to` | Filing-date range, `YYYY-MM-DD`; defaults to the whole cached window |
| `limit` | Records to return: default 50, maximum 500. `total` counts every match |

Results are newest first by filing date. The response states the cached window
in `coverage`; dates outside it return whatever the cache holds (no match, not
an error).

Example response (one record, from the real cache):

```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "sale_notices": [
    {
      "ticker": "AAPL",
      "cik": "320193",
      "issuer": "Apple Inc.",
      "name": "LEVINSON ARTHUR D",
      "relationships": ["Director"],
      "form_type": "144",
      "filing_date": "2026-11-16",
      "notice_date": "2026-11-16",
      "accession_number": "0001921094-26-001188",
      "replaces_accession_number": null,
      "plan_adoption_dates": [],
      "securities": [
        {
          "security_title": "Common",
          "shares_to_sell": 90000,
          "market_value": 31765885,
          "shares_outstanding": 14532182000,
          "approximate_sale_date": "2026-11-16",
          "exchange": "NASDAQ",
          "broker": "Charles Schwab & Co., Inc."
        }
      ]
    }
  ],
  "source": "SEC_EDGAR",
  "dataVersion": "form144-2026-11-18",
  "coverage": { "from": "2026-10-20", "to": "2026-11-18" },
  "timestamp": "2026-11-19T00:00:00.000Z"
}
```

## Current coverage

- **Window:** 2026-10-20 to 2026-11-18 (the 30 most recent days at ingest time;
  21 filing days — EDGAR publishes no daily index on weekends or federal
  holidays).
- **Records:** 2,857 notices out of 2,857 unique filings in the window
  (100%). Every day file also records its index count and any accession that
  failed to parse, so a future gap is visible in the data, not silent.
- **Parity:** `scripts/form144/parity.ts` re-counts the EDGAR index for the
  three most recent days and compares: 586/586 = 100.00% (gate: 85%).

## Refreshing the cache

```bash
pnpm ingest:form144 -- --from=2026-11-19 --to=2026-11-19   # one day
pnpm ingest:form144                                        # default: the last 30 days
pnpm parity:form144                                        # verify against EDGAR
pnpm build:data                                            # rebuild build/assets, including form144
```

The ingest (`scripts/form144/ingest.ts`) downloads each day's form index from
`https://www.sec.gov/Archives/edgar/daily-index/<YYYY>/QTR<n>/form.<YYYYMMDD>.idx`,
keeps the `144` and `144/A` entries, downloads each filing's `.txt` submission,
and parses the XML block into `data/form144/days/<YYYY-MM-DD>.json` plus a
`manifest.json`. Details that matter:

- The index lists every filing **twice** (once under the issuer's CIK path, once
  under the reporting owner's). Entries are deduplicated by accession number, so
  index *lines* are not filings: 2026-11-18 has 308 lines and 154 filings.
- Days already ingested are skipped, so re-running is idempotent and an
  interrupted run resumes. `--force` re-downloads the range.
- Some filers namespace-prefix every XML tag (`own:`, `com:`). The parser strips
  tag prefixes before reading fields.
- SEC Archives answers HTTP 403 (not 404) for a day with no index. The ingest
  retries once after a pause before treating the day as a weekend or holiday.
- Fair access: a declared `User-Agent` (`AIKitLLC data.ai-kit.net
  tuannx87@gmail.com`) and request starts paced to about 7 per second, under the
  SEC's 10-per-second ceiling.
- The cache is only as fresh as the last ingest run. There is no scheduled
  refresh yet; treat `coverage.to` as the dataset's "as of" date.

## Field mapping vs the Financial Datasets shape

The record shape mirrors the Financial Datasets sale-notices API so existing
consumers recognize it. Every field below comes from the filing's XML; nothing
is inferred.

| This API | EDGAR XML | Financial Datasets | Notes |
| :-- | :-- | :-- | :-- |
| `ticker` | — (by CIK) | `ticker` | Not in the filing. Resolved with the SEC's `company_tickers.json`. Null when the issuer has no listed ticker; multi-class issuers get the first ticker the SEC lists |
| `cik` | `issuerCik` | — | Added: the stable issuer key behind `ticker` |
| `issuer` | `issuerName` | `issuer` | |
| `name` | `nameOfPersonForWhoseAccountTheSecuritiesAreToBeSold` | `name` | |
| `relationships` | `relationshipToIssuer` (repeatable) | `relationships` | Values as filed ("Officer", "Director", "10% Owner", free text) |
| `form_type` | `submissionType` | `form_type` | `144` or `144/A` |
| `filing_date` | daily index | `filing_date` | |
| `notice_date` | `noticeDate` | `notice_date` | Converted from MM/DD/YYYY to ISO |
| `accession_number` | submission file name | `accession_number` | |
| `replaces_accession_number` | `previousAccessionNumber` | `replaces_accession_number` | Only on `144/A` amendments; null otherwise |
| `plan_adoption_dates` | `planAdoptionDate` (repeatable) | — | Added: Rule 10b5-1 plan adoption dates, when the filer reports them |
| `securities[].security_title` | `securitiesClassTitle` | `securities[].security_title` | |
| `securities[].shares_to_sell` | `noOfUnitsSold` | `securities[].shares_to_sell` | Despite the tag name, this is the amount **proposed** for sale |
| `securities[].market_value` | `aggregateMarketValue` | `securities[].market_value` | USD, as filed |
| `securities[].shares_outstanding` | `noOfUnitsOutstanding` | `securities[].shares_outstanding` | |
| `securities[].approximate_sale_date` | `approxSaleDate` | `securities[].approximate_sale_date` | Converted to ISO |
| `securities[].exchange` | `securitiesExchangeName` | `securities[].exchange` | Free text as filed ("NASDAQ", "NYSE", sometimes blank) |
| `securities[].broker` | `brokerOrMarketmakerDetails/name` | `securities[].broker` | Name only; the broker's address is in the filing but not served |

Known gaps:

- A filing whose submission cannot be fetched or carries no XML block is not
  served on that run. Its accession is listed in the day file's `failed`, the
  parity script's percentage makes the gap visible, and re-running the ingest
  for that day retries it. The current cache has no such gap.
- The filing also reports securities acquired and sales in the past three
  months. Those blocks are not served in this version.
- `ticker` can be stale if the SEC's mapping changes between ingest runs; the
  CIK is the durable key.
