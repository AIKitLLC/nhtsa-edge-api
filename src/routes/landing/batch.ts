/**
 * The batch decoder page (/batch): paste or upload a list of VINs, get a table and a CSV.
 */

import { renderPage, type PageInfo } from "./layout";
import { BATCH_JS } from "./batch-script";

export function renderBatchPage(info: PageInfo): string {
  const banner = info.healthy
    ? ""
    : '<p class="banner" role="alert">The vPIC data assets could not be read, so decoding is temporarily unavailable.</p>';

  const body = `    <section class="hero">
      <div class="eyebrow">vPIC data &middot; batch</div>
      <h1>Decode a list of VINs.</h1>
      <p class="lead">Paste VINs, one per line, or load a CSV. Add a model year after a comma to help VINs that do not carry it (<code>5YJ3E1EB1NF000001,2022</code>). Decoding runs in this Worker, 50 VINs per request, up to 500 per run. Nothing is stored.</p>
      ${banner}
      <div class="decoder">
        <form id="batch-form" autocomplete="off" novalidate>
          <label class="sr" for="batch-input">VINs, one per line</label>
          <textarea class="ta" id="batch-input" rows="8" spellcheck="false" autocapitalize="characters" placeholder="1HGCM82633A004352&#10;5YJ3E1EB1NF000001,2022"></textarea>
          <div class="row">
            <label class="chip" for="batch-file">Load CSV or text file</label>
            <input class="sr" id="batch-file" type="file" accept=".csv,.txt,text/csv,text/plain">
            <button class="btn" id="batch-run" type="submit">Decode all</button>
          </div>
          <p class="hint" id="batch-status" aria-live="polite">A first line that says VIN is treated as a header and skipped.</p>
        </form>
        <div class="result" id="batch-out"></div>
        <p><a class="link" id="batch-download" download="vin-decodes.csv" hidden>Download CSV</a></p>
        <noscript><p class="hint">JavaScript is needed here. Without it, POST to <code>/vehicles/DecodeVINValuesBatch/</code>; see the <a href="/docs">API docs</a>.</p></noscript>
      </div>
    </section>
`;

  return renderPage(info, {
    title: "Batch VIN decoder | AI Kit Data",
    description: "Decode up to 500 VINs at once from a pasted list or a CSV file, and download the results as CSV. Offline NHTSA vPIC decoding.",
    body,
    script: BATCH_JS,
  });
}
