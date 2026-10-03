/**
 * Client script of the batch page (/batch): decodes a pasted or uploaded list of VINs through
 * this Worker's POST /vehicles/DecodeVINValuesBatch/ (50 per request) and offers a CSV download.
 * Nothing leaves the browser except those requests to this same origin.
 *
 * Everything from the API is written with textContent, never innerHTML. CSV cells that a
 * spreadsheet would read as a formula are prefixed with an apostrophe.
 */

export const BATCH_JS = String.raw`
(function () {
  "use strict";
  var MAX_VINS = 500;
  var CHUNK = 50;
  var form = document.getElementById("batch-form");
  var input = document.getElementById("batch-input");
  var file = document.getElementById("batch-file");
  var run = document.getElementById("batch-run");
  var status = document.getElementById("batch-status");
  var out = document.getElementById("batch-out");
  var download = document.getElementById("batch-download");
  var csvUrl = null;
  var COLUMNS = [
    ["VIN", "VIN"], ["Year", "ModelYear"], ["Make", "Make"], ["Model", "Model"], ["Trim", "Trim"],
    ["Body class", "BodyClass"], ["Error code", "ErrorCode"], ["Error", "ErrorText"]
  ];
  // The table leaves out the long error text; the CSV keeps every column
  var SHOWN = COLUMNS.slice(0, 7);

  function el(tag, text) {
    var n = document.createElement(tag);
    if (text !== null && text !== undefined) n.textContent = text;
    return n;
  }
  function say(text, bad) {
    status.textContent = text;
    status.className = bad ? "hint error" : "hint";
  }

  // "VIN" or "VIN,year" per line; commas, semicolons, tabs and spaces separate; a header line is skipped
  function parse(text) {
    var entries = [];
    text.split(/[\r\n]+/).forEach(function (line, i) {
      var parts = line.split(/[,;\t ]+/).map(function (p) { return p.replace(/[^A-Za-z0-9*]/g, ""); }).filter(Boolean);
      if (parts.length === 0) return;
      var vin = parts[0].toUpperCase();
      if (i === 0 && vin === "VIN") return;
      var year = parts[1] && /^[0-9]{4}$/.test(parts[1]) ? parts[1] : "";
      entries.push({ vin: vin, year: year, ok: /^[A-Z0-9*]{3,17}$/.test(vin) });
    });
    return entries;
  }

  function post(batch) {
    var data = batch.map(function (e) { return e.vin + (e.year ? "," + e.year : ""); }).join(";");
    return fetch("/vehicles/DecodeVINValuesBatch/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ format: "json", data: data })
    }).then(function (res) {
      if (res.status === 429) throw new Error("Rate limit reached. Wait a minute and run the rest again.");
      return res.json().catch(function () { return null; }).then(function (json) {
        if (!res.ok || !json || !json.Results) {
          throw new Error(json && json.error ? json.error.message : "Request failed (HTTP " + res.status + ").");
        }
        return json.Results;
      });
    });
  }

  function csvCell(value) {
    var s = String(value === null || value === undefined ? "" : value);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.split('"').join('""') + '"' : s;
  }

  function render(rows) {
    out.textContent = "";
    var wrap = el("div");
    wrap.className = "scroll tall";
    var table = el("table");
    table.className = "attrs";
    var head = el("tr");
    SHOWN.forEach(function (c) { head.appendChild(el("th", c[0])); });
    table.appendChild(head);
    rows.forEach(function (r) {
      var tr = el("tr");
      SHOWN.forEach(function (c) { tr.appendChild(el("td", r[c[1]])); });
      table.appendChild(tr);
    });
    wrap.appendChild(table);
    out.appendChild(wrap);

    var csv = [COLUMNS.map(function (c) { return csvCell(c[0]); }).join(",")]
      .concat(rows.map(function (r) { return COLUMNS.map(function (c) { return csvCell(r[c[1]]); }).join(","); }))
      .join("\r\n");
    if (csvUrl) URL.revokeObjectURL(csvUrl);
    csvUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    download.href = csvUrl;
    download.hidden = false;
  }

  function start(entries) {
    var valid = entries.filter(function (e) { return e.ok; });
    var skipped = entries.length - valid.length;
    var rows = entries.filter(function (e) { return !e.ok; }).map(function (e) {
      return { VIN: e.vin, ErrorCode: "", ErrorText: "Not a VIN: use 3 to 17 letters, digits or *" };
    });
    var done = [];
    var chunks = [];
    for (var i = 0; i < valid.length; i += CHUNK) chunks.push(valid.slice(i, i + CHUNK));

    run.disabled = true;
    download.hidden = true;
    out.textContent = "";

    var chain = Promise.resolve();
    chunks.forEach(function (batch, n) {
      chain = chain.then(function () {
        say("Decoding " + Math.min((n + 1) * CHUNK, valid.length) + " of " + valid.length + "...");
        return post(batch).then(function (results) { done = done.concat(results); });
      });
    });
    chain.then(function () {
      var failed = done.filter(function (r) { return r.ErrorCode !== "0"; }).length;
      render(done.concat(rows));
      say(done.length + " decoded, " + failed + " with an error code" + (skipped ? ", " + skipped + " skipped as not VINs" : "") + ".");
    }, function (err) {
      if (done.length > 0) render(done.concat(rows));
      say((err && err.message ? err.message : "Could not reach the API.") + (done.length > 0 ? " Showing the " + done.length + " decoded so far." : ""), true);
    }).then(function () { run.disabled = false; });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var entries = parse(input.value);
    if (entries.length === 0) return say("Paste at least one VIN, one per line.", true);
    if (entries.length > MAX_VINS) return say("At most " + MAX_VINS + " VINs per run; you pasted " + entries.length + ".", true);
    start(entries);
  });

  file.addEventListener("change", function () {
    var f = file.files && file.files[0];
    if (!f) return;
    if (f.size > 1048576) return say("That file is over 1 MB.", true);
    var reader = new FileReader();
    reader.onload = function () { input.value = String(reader.result || ""); say("Loaded " + parse(input.value).length + " lines from " + f.name + "."); };
    reader.onerror = function () { say("Could not read that file.", true); };
    reader.readAsText(f);
  });
})();
`;
