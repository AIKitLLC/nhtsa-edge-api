/**
 * The VIN decoder page (/vpic): a live decoder that calls this Worker's own API,
 * real numbers from the bundled data, and the verification story of the vPIC dataset.
 */

import type { StatsAsset } from "../../vpic/types";
import { escapeHtml, icon, number, renderPage, REPO, type PageInfo } from "./layout";
import { LANDING_JS } from "./script";

/** Placeholder host in the snippets; the client script swaps in the real origin. */
const HOST = "https://your-worker.example";

/** Quick-pick chips: [label, VIN]. Each must decode cleanly to that make (test/landing.test.ts). */
export const SAMPLE_VINS: readonly (readonly [string, string])[] = [
  ["Honda Accord", "1HGCM82633A004352"],
  ["Tesla Model 3", "5YJ3E1EB1NF000001"],
  ["Ford Explorer", "1FM5K8D84HGA00001"],
  ["Toyota Prius", "JTDKN3DU6A0123456"],
];

const ENDPOINTS: readonly (readonly [string, string, string])[] = [
  ["GET", "/api/v1/vin/:vin", "Clean JSON: typed fields plus every decoded attribute"],
  ["GET", "/api/v1/vin/:vin/unified", "Decode plus US EPA and EU RDW reference data"],
  ["GET", "/vehicles/DecodeVinValues/:vin?format=json", "Drop-in for the vPIC API (add clean=true to drop empty values)"],
  ["POST", "/vehicles/DecodeVINValuesBatch/", "vPIC batch decode, up to 50 VINs per request"],
  ["GET", "/api/v1/makes", "Every make in the bundled dataset"],
  ["GET", "/api/v1/models?make=toyota", "Models of a make"],
  ["GET", "/api/v1/vin/:vin/compare", "This decoder against the live vPIC API, field by field"],
];

function statsHtml(stats: StatsAsset | null, dataVersion: string | null): string {
  const cells: string[] = [];
  const cell = (value: string, label: string, cls = ""): void => {
    cells.push(`<div class="stat"><b${cls ? ` class="${cls}"` : ""}>${value}</b><span>${escapeHtml(label)}</span></div>`);
  };
  if (stats) {
    cell(number(stats.wmis), "manufacturer codes (WMIs)");
    cell(number(stats.makes), "makes");
    cell(number(stats.models), "models");
    cell(number(stats.patterns), "decoding patterns");
  }
  // wbr lets the version wrap at its underscores instead of mid-word
  cell(escapeHtml(dataVersion ?? "unavailable").replace(/_/g, "_<wbr>"), "vPIC data version", "mono sm");
  return `<div class="stats">${cells.join("")}</div>`;
}

export function renderVpicPage(info: PageInfo): string {
  const first = SAMPLE_VINS[0]?.[1] ?? "";
  const banner = info.healthy
    ? ""
    : '<p class="banner" role="alert">The vPIC data assets could not be read, so decoding is temporarily unavailable.</p>';
  const chips = SAMPLE_VINS.map(
    ([label, vin]) => `<button type="button" class="chip" data-vin="${escapeHtml(vin)}" title="${escapeHtml(vin)}">${escapeHtml(label)}</button>`
  ).join("");
  const endpoints = ENDPOINTS.map(
    ([verb, path, text]) =>
      `<li><span class="verb">${verb}</span><code>${escapeHtml(path)}</code><span class="d">${escapeHtml(text)}</span></li>`
  ).join("");

  const body = `    <section class="hero">
      <div class="eyebrow">vPIC data &middot; offline &middot; at the edge</div>
      <h1>Decode any VIN at the edge.</h1>
      <p class="lead">Full NHTSA vPIC decoding runs inside the Worker, with no round trip to NHTSA. It is a port of NHTSA's own <code>spVinDecode</code> over the official monthly dump, checked against NHTSA's SQL and the live API on every update.</p>
      ${banner}
      <div class="decoder" id="decoder">
        <form id="vin-form" autocomplete="off" novalidate>
          <label class="sr" for="vin">Vehicle Identification Number</label>
          <div class="row">
            <div class="field"><input class="vin" id="vin" name="vin" type="text" inputmode="text" maxlength="17" spellcheck="false" autocapitalize="characters" autocomplete="off" placeholder="${escapeHtml(first)}" aria-describedby="vin-hint"></div>
            <button class="btn" id="decode-btn" type="submit">Decode</button>
          </div>
          <p class="hint" id="vin-hint">3 to 17 characters. Use <code>*</code> as a wildcard; partial VINs are decoded too. Have a list? <a href="/batch">Decode many VINs at once</a>.</p>
          <div class="chips"><span>Try:</span>${chips}</div>
        </form>
        <div class="result" id="result" aria-live="polite" hidden></div>
        <div class="curl">
          <p class="hint">The same request from your terminal:</p>
          <pre class="code"><code id="curl-cmd" data-host>curl -s "${HOST}/api/v1/vin/${escapeHtml(first)}"</code><button type="button" class="copy" data-copy="curl-cmd">Copy</button></pre>
        </div>
        <noscript><p class="hint">JavaScript is needed for the live decoder; the API itself works with curl.</p></noscript>
      </div>
    </section>

    ${statsHtml(info.stats, info.dataVersion)}

    <section class="block" aria-labelledby="why">
      <h2 id="why">Fast, checked, compatible</h2>
      <p class="sec-lead">Built to replace calls to vpic.nhtsa.dot.gov without changing your client.</p>
      <div class="cards">
        <div class="card">${icon('<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>')}<h3>No round trip</h3><p>Every decode is answered in the Worker from bundled vPIC data, in a few milliseconds. It keeps working when NHTSA is slow or down.</p></div>
        <div class="card">${icon('<path d="M20 6 9 17l-5-5"/>')}<h3>Checked against NHTSA</h3><p>Each update restores NHTSA's original dump in PostgreSQL and compares this decoder with NHTSA's own SQL functions, then with the live API, before any data is committed.</p></div>
        <div class="card">${icon('<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>')}<h3>Drop-in for vPIC</h3><p>DecodeVinValues, DecodeVin and DecodeVINValuesBatch return vPIC's JSON shape. Point your client at this host and keep the rest.</p></div>
      </div>
    </section>

    <section class="block" id="api" aria-labelledby="api-h">
      <h2 id="api-h">API</h2>
      <p class="sec-lead">JSON over HTTPS, CORS open, no API key. Responses carry <code>X-Vpic-Data-Version</code> so you know which dump answered.</p>
      <ul class="ep">${endpoints}</ul>
      <pre class="code"><code id="fetch-snippet" data-host>const res = await fetch("${HOST}/api/v1/vin/${escapeHtml(first)}");
const { data } = await res.json();
console.log(data.modelYear, data.make, data.model); // 2003 HONDA Accord</code><button type="button" class="copy" data-copy="fetch-snippet">Copy</button></pre>
    </section>

    <section class="block" id="trust" aria-labelledby="trust-h">
      <h2 id="trust-h">How correctness is kept</h2>
      <p class="sec-lead">Data updates weekly, and an update is a git commit, so it can be reviewed and reverted like code. Serving <code>${escapeHtml(info.dataVersion ?? "unavailable")}</code>.</p>
      <ol class="steps">
        <li><b>The data equals NHTSA's dump</b><span>Every table in the repository is compared row by row with the original dump restored in PostgreSQL.</span></li>
        <li><b>The decoder equals NHTSA's SQL</b><span>Thousands of VINs, and every helper function, are decoded by NHTSA's functions and by this decoder; any unexplained difference stops the update.</span></li>
        <li><b>The result matches the live API</b><span>A fixed sample is compared field by field with the live vPIC API before data is committed or deployed.</span></li>
        <li><b>Defects in NHTSA's dump are documented</b><span>Where the dump's code is wrong and the live API shows the right answer, the decoder follows the live API and the finding is written down with its evidence.</span></li>
      </ol>
      <div class="links">
        <a href="${REPO}/blob/main/docs/DATA.md">Data pipeline and verification</a>
        <a href="${REPO}/blob/main/docs/NHTSA-ERRATA.md">NHTSA errata</a>
        <a href="${REPO}#readme">README</a>
      </div>
    </section>
`;

  return renderPage(info, {
    title: "VIN decoder | AI Kit Data",
    description: "Decode any VIN at the edge. NHTSA vPIC decoding runs inside the Worker, verified against NHTSA's own SQL and the live API.",
    body,
    script: LANDING_JS,
  });
}
