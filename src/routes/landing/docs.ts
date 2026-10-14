/**
 * The API reference page (/docs), rendered on the server from the OpenAPI document so the
 * page and /openapi.json cannot disagree. No client script and no third-party assets.
 */

import { OPENAPI } from "../openapi/spec";
import { escapeHtml, renderPage, REPO, type PageInfo } from "./layout";

interface Parameter {
  readonly name: string;
  readonly in: string;
  readonly required?: boolean;
  readonly description?: string;
}
interface Operation {
  readonly summary: string;
  readonly description?: string;
  readonly tags: readonly string[];
  readonly parameters?: readonly Parameter[];
  readonly responses: Readonly<Record<string, { readonly description: string }>>;
}

function operationHtml(verb: string, path: string, op: Operation): string {
  const params = (op.parameters ?? [])
    .map(
      (p) =>
        `<li><code>${escapeHtml(p.name)}</code> <span class="d">${escapeHtml(p.in)}${p.required ? ", required" : ""}${p.description ? ` &middot; ${escapeHtml(p.description)}` : ""}</span></li>`
    )
    .join("");
  const responses = Object.entries(op.responses)
    .map(([code, r]) => `<li><code>${escapeHtml(code)}</code> <span class="d">${escapeHtml(r.description)}</span></li>`)
    .join("");
  return `<div class="card op">
        <h3><span class="verb">${escapeHtml(verb.toUpperCase())}</span> <code>${escapeHtml(path)}</code></h3>
        <p>${escapeHtml(op.summary)}.${op.description ? ` ${escapeHtml(op.description)}` : ""}</p>
        ${params ? `<h4>Parameters</h4><ul class="plain">${params}</ul>` : ""}
        <h4>Responses</h4><ul class="plain">${responses}</ul>
      </div>`;
}

export function renderDocsPage(info: PageInfo): string {
  const groups = OPENAPI.tags
    .map((tag) => {
      const ops: string[] = [];
      for (const [path, methods] of Object.entries(OPENAPI.paths)) {
        for (const [verb, op] of Object.entries(methods as Record<string, Operation>)) {
          if (op.tags.includes(tag.name)) ops.push(operationHtml(verb, path, op));
        }
      }
      return `<section class="block" aria-labelledby="t-${escapeHtml(tag.name.replace(/\W+/g, "-"))}">
      <h2 id="t-${escapeHtml(tag.name.replace(/\W+/g, "-"))}">${escapeHtml(tag.name)}</h2>
      <p class="sec-lead">${escapeHtml(tag.description)}.</p>
      <div class="cards one">${ops.join("")}</div>
    </section>`;
    })
    .join("\n    ");

  const body = `    <section class="hero">
      <div class="eyebrow">API reference</div>
      <h1>${escapeHtml(OPENAPI.info.title)}</h1>
      <p class="lead">${escapeHtml(OPENAPI.info.description)}</p>
      <div class="links">
        <a href="/openapi.json">openapi.json</a>
        <a href="/llms.txt">llms.txt</a>
        <a href="${REPO}">Source on GitHub</a>
      </div>
    </section>
    ${groups}
`;

  return renderPage(info, {
    title: "API reference | AI Kit Data",
    description: "Endpoints of the AI Kit Data API: offline NHTSA vPIC VIN decoding, catalog and recalls. OpenAPI 3.1, no API key.",
    body,
  });
}
