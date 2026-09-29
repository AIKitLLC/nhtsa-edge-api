/**
 * The hub (/): a catalog of the US public datasets this site serves. Each dataset
 * states plainly whether it is live, partially available or only planned.
 */

import { escapeHtml, icon, number, renderPage, REPO, type PageInfo } from "./layout";

export type DatasetStatus = "live" | "partial" | "planned";

export interface Dataset {
  readonly id: string;
  readonly name: string;
  readonly agency: string;
  readonly status: DatasetStatus;
  readonly summary: string;
  readonly links: readonly (readonly [string, string])[];
}

const STATUS_LABEL: Record<DatasetStatus, string> = { live: "Live", partial: "Partial", planned: "Planned" };

/**
 * The catalog. "Live" means answered from data bundled in the Worker; "Partial" means
 * part of it is available; "Planned" means not available yet.
 */
export const DATASETS: readonly Dataset[] = [
  {
    id: "vpic",
    name: "Vehicle identification (vPIC)",
    agency: "NHTSA",
    status: "live",
    summary: "Decode any VIN offline: make, model, year, trim, engine, body, plant and safety equipment, for every vehicle in NHTSA's vPIC database.",
    links: [
      ["Try the decoder", "/vpic"],
      ["API", "/vpic#api"],
    ],
  },
  {
    id: "recalls",
    name: "Safety recalls",
    agency: "NHTSA",
    status: "partial",
    summary: "Recalls by VIN, proxied to NHTSA's API and cached for six hours. An offline copy is planned.",
    links: [["API", "/vpic#api"]],
  },
  {
    id: "fuel-economy",
    name: "Fuel economy and electric range",
    agency: "EPA and DOE",
    status: "partial",
    summary: "Electric range, MPGe and motor data by model year and model are added to the unified VIN profile. The full dataset is planned.",
    links: [["Unified profile", "/vpic#api"]],
  },
  {
    id: "complaints-ncap",
    name: "Complaints and crash test ratings",
    agency: "NHTSA",
    status: "planned",
    summary: "Owner complaints and NCAP star ratings, keyed by make, model and year.",
    links: [],
  },
];

function datasetCard(d: Dataset, stats: PageInfo["stats"], dataVersion: string | null): string {
  const links = d.links.map(([label, href]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join("");
  const facts =
    d.id === "vpic" && stats
      ? `<p class="ds-facts">${number(stats.models)} models &middot; ${number(stats.patterns)} patterns &middot; data <code>${escapeHtml(dataVersion ?? "unavailable")}</code></p>`
      : "";
  return `<article class="ds" id="${escapeHtml(d.id)}">
        <div class="ds-head"><span class="agency">${escapeHtml(d.agency)}</span><span class="status ${d.status}">${STATUS_LABEL[d.status]}</span></div>
        <h3>${escapeHtml(d.name)}</h3>
        <p>${escapeHtml(d.summary)}</p>
        ${facts}
        ${links ? `<div class="ds-links">${links}</div>` : ""}
      </article>`;
}

export function renderHub(info: PageInfo): string {
  const banner = info.healthy
    ? ""
    : '<p class="banner" role="alert">Some data assets could not be read, so datasets served from them are temporarily unavailable.</p>';
  const cards = DATASETS.map((d) => datasetCard(d, info.stats, info.dataVersion)).join("\n      ");

  const body = `    <section class="hero">
      <div class="eyebrow">US public data &middot; at the edge</div>
      <h1>US public data, ready to use.</h1>
      <p class="lead">Government datasets, versioned in git, checked against their source and served fast from Cloudflare's edge, starting with NHTSA's vehicle database. JSON over HTTPS, no API key.</p>
      ${banner}
      <div class="cta">
        <a class="btn-link" href="#datasets">Browse datasets</a>
        <a class="btn-link ghost" href="/vpic">Try the VIN decoder</a>
      </div>
    </section>

    <section class="block" id="datasets" aria-labelledby="datasets-h">
      <h2 id="datasets-h">Datasets</h2>
      <p class="sec-lead">What is available today, and what is coming. A status is only "Live" when the data is served from this site.</p>
      <div class="cards ds-grid">
      ${cards}
        <article class="ds ds-add">
          <div class="ds-head"><span class="agency">Your call</span></div>
          <h3>Suggest a dataset</h3>
          <p>Tell us which US public dataset you need next and how you would query it.</p>
          <div class="ds-links"><a href="${REPO}/issues" rel="noopener">Open an issue</a></div>
        </article>
      </div>
    </section>

    <section class="block" aria-labelledby="how-h">
      <h2 id="how-h">How every dataset is handled</h2>
      <p class="sec-lead">The same rules apply to each source, starting with the strictest one, vPIC.</p>
      <div class="cards">
        <div class="card">${icon('<path d="M12 3 4 7v6c0 4.5 3.4 7.7 8 9 4.6-1.3 8-4.5 8-9V7l-8-4z"/>')}<h3>From the source</h3><p>Official releases and APIs of the publishing agency. Nothing is scraped, invented or mocked.</p></div>
        <div class="card">${icon('<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>')}<h3>Versioned in git</h3><p>An update is a commit with its data and expected results, so it can be reviewed and reverted like code.</p></div>
        <div class="card">${icon('<path d="M20 6 9 17l-5-5"/>')}<h3>Checked before it ships</h3><p>Where the source allows it, data and results are compared with the source's own code and live service before anything is deployed.</p></div>
      </div>
    </section>
`;

  return renderPage(info, {
    title: "AI Kit Data | US public data, ready to use",
    description: "US public datasets, versioned in git, checked against their source and served fast from the edge. Starting with NHTSA vehicle data.",
    body,
  });
}
