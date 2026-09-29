/**
 * Client script of the landing page: the live VIN decoder (calls this Worker's own
 * /api/v1/vin/:vin), the curl snippet and the copy buttons.
 *
 * Kept free of backticks, "${" and backslashes so it can live in a template string.
 * Everything from the API is written with textContent, never innerHTML.
 */

export const LANDING_JS = String.raw`
(function () {
  "use strict";
  var form = document.getElementById("vin-form");
  var input = document.getElementById("vin");
  var button = document.getElementById("decode-btn");
  var out = document.getElementById("result");
  var curlEl = document.getElementById("curl-cmd");
  var VIN_OK = /^[A-Z0-9*]{3,17}$/;
  var seq = 0;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== null && text !== undefined) n.textContent = text;
    return n;
  }
  function clean(v) {
    return String(v || "").toUpperCase().replace(/[^A-Z0-9*]/g, "").slice(0, 17);
  }
  function setCurl(vin) {
    curlEl.textContent = 'curl -s "' + location.origin + "/api/v1/vin/" + vin + '"';
  }
  function showError(message) {
    out.hidden = false;
    out.textContent = "";
    out.appendChild(el("p", "error", message));
  }
  function fact(list, label, value) {
    if (value === null || value === undefined || value === "") return;
    var box = el("div", "fact");
    box.appendChild(el("dt", null, label));
    // a zero-width space after "/" lets long values wrap at slashes, not mid-word
    box.appendChild(el("dd", null, String(value).split("/").join("/\u200b")));
    list.appendChild(box);
  }

  function render(json, roundTrip) {
    var d = json.data;
    out.hidden = false;
    out.textContent = "";

    var title = [d.modelYear, d.make, d.model, d.trim].filter(Boolean).join(" ");
    out.appendChild(el("h3", "headline", title || "No vehicle data for this VIN"));
    out.appendChild(el("p", "sub", d.manufacturer || d.vin));

    var badges = el("div", "badges");
    if (d.isCleanDecode) badges.appendChild(el("span", "badge ok", "Clean decode"));
    else badges.appendChild(el("span", "badge warn", "Error code " + (d.errorCodes.join(", ") || "n/a")));
    out.appendChild(badges);
    if (!d.isCleanDecode && d.errorText) {
      out.appendChild(el("p", "note", d.errorText + (d.suggestedVin ? " Suggested VIN: " + d.suggestedVin : "")));
    }

    var list = el("dl", "facts");
    fact(list, "Vehicle type", d.vehicleType);
    fact(list, "Body class", d.bodyClass);
    fact(list, "Series", d.series);
    fact(list, "Doors", d.doors);
    fact(list, "Drive", d.driveType);
    var engine = [];
    if (d.engineCylinders) engine.push(d.engineCylinders + " cyl");
    if (d.displacementL) engine.push(Number(d.displacementL).toFixed(1) + " L");
    if (d.engineHp) engine.push(Math.round(d.engineHp) + " hp");
    fact(list, "Engine", engine.join(" · "));
    fact(list, "Fuel", d.fuelType);
    fact(list, "Electrification", d.electrificationLevel);
    fact(list, "Plant", [d.plantCity, d.plantState, d.plantCountry].filter(Boolean).join(", "));
    if (list.children.length > 0) out.appendChild(list);

    out.appendChild(
      el(
        "p",
        "meta",
        "Decoded in " + json.decodeMs + " ms on the server · " + roundTrip + " ms round trip · data " + json.dataVersion
      )
    );

    var keys = Object.keys(d.attributes || {}).sort();
    if (keys.length > 0) {
      var details = el("details", "all");
      details.appendChild(el("summary", null, "All " + keys.length + " decoded attributes"));
      var wrap = el("div", "scroll");
      var table = el("table", "attrs");
      keys.forEach(function (key) {
        var row = el("tr");
        row.appendChild(el("td", null, key));
        row.appendChild(el("td", null, d.attributes[key]));
        table.appendChild(row);
      });
      wrap.appendChild(table);
      details.appendChild(wrap);
      out.appendChild(details);
    }
  }

  function decode(raw, remember) {
    var vin = clean(raw);
    if (!VIN_OK.test(vin)) {
      showError("Enter 3 to 17 characters: letters, digits, or * as a wildcard.");
      return;
    }
    var mine = ++seq;
    button.disabled = true;
    button.textContent = "Decoding...";
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 15000);
    var started = performance.now();

    fetch("/api/v1/vin/" + encodeURIComponent(vin), { headers: { Accept: "application/json" }, signal: controller.signal })
      .then(function (res) {
        return res.json().catch(function () { return null; }).then(function (json) { return { res: res, json: json }; });
      })
      .then(function (r) {
        if (mine !== seq) return;
        if (!r.json) throw new Error("Unexpected response (HTTP " + r.res.status + ").");
        if (!r.res.ok || !r.json.success) throw new Error(r.json.error ? r.json.error.message : "Request failed.");
        render(r.json, Math.round(performance.now() - started));
        setCurl(vin);
        if (remember) history.replaceState(null, "", "?vin=" + vin);
      })
      .catch(function (err) {
        if (mine !== seq) return;
        showError(err && err.name === "AbortError" ? "The request timed out." : (err && err.message) || "Could not reach the API.");
      })
      .then(function () {
        clearTimeout(timer);
        if (mine === seq) {
          button.disabled = false;
          button.textContent = "Decode";
        }
      });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    decode(input.value, true);
  });
  input.addEventListener("input", function () {
    var cleaned = clean(input.value);
    if (cleaned !== input.value) input.value = cleaned;
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-vin]"), function (chip) {
    chip.addEventListener("click", function () {
      input.value = chip.getAttribute("data-vin");
      decode(input.value, true);
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("data-copy"));
      if (!target || !navigator.clipboard) return;
      navigator.clipboard.writeText(target.textContent || "").then(function () {
        var label = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = label; }, 1400);
      }, function () {});
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-host]"), function (node) {
    node.textContent = node.textContent.split("https://your-worker.example").join(location.origin);
  });

  var fromUrl = clean(new URLSearchParams(location.search).get("vin"));
  var first = VIN_OK.test(fromUrl) ? fromUrl : clean(document.querySelector("[data-vin]").getAttribute("data-vin"));
  input.value = first;
  decode(first, false);
})();
`;
