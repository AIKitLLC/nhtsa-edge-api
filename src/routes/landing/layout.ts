/**
 * Shared page frame of the website (hub and dataset pages): head, header, footer,
 * inline style and script under one CSP nonce, and the small helpers they share.
 */

import type { StatsAsset } from "../../vpic/types";
import { LANDING_CSS } from "./style";

export interface PageInfo {
  readonly colo: string;
  readonly country: string;
  readonly dataVersion: string | null;
  readonly healthy: boolean;
  readonly stats: StatsAsset | null;
  /** CSP nonce for the inline style and script. */
  readonly nonce: string;
}

export interface PageOptions {
  /** <title> and og:title. */
  readonly title: string;
  readonly description: string;
  readonly body: string;
  /** Client script for the page, if any. */
  readonly script?: string;
}

export const REPO = "https://github.com/AIKitLLC/nhtsa-edge-api";

export const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);

export const number = (n: number): string => n.toLocaleString("en-US");

export function icon(path: string): string {
  return `<div class="ico"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg></div>`;
}

const GITHUB_ICON =
  '<svg height="18" width="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';

const LOGO =
  '<svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="2" y="7" width="28" height="18" rx="5" stroke="currentColor" stroke-width="2.2"/><path d="M8 13v6M12 13v6M16 13v6M20 13v6M24 13v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".75"/></svg>';

const FAVICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0369a1"/><path d="M8 11v10M12 11v10M16 11v10M20 11v10M24 11v10" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>'
  );

export function renderPage(info: PageInfo, page: PageOptions): string {
  const nonce = escapeHtml(info.nonce);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const status = info.healthy
    ? '<span class="pill"><i></i>Operational</span>'
    : '<span class="pill bad"><i></i>Degraded</span>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#0369a1">
<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<link rel="icon" href="${FAVICON}">
<style nonce="${nonce}">${LANDING_CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap">
  <header class="top">
    <a class="brand" href="/">${LOGO}<span>AI Kit Data</span></a>
    <nav class="nav" aria-label="Main">
      <a class="link" href="/#datasets">Datasets</a>
      <a class="link" href="/vpic">VIN decoder</a>
      <a class="link hide-sm" href="${REPO}#readme">Docs</a>
      ${status}
      <a class="gh" href="${REPO}" rel="noopener">${GITHUB_ICON}GitHub</a>
    </nav>
  </header>

  <main id="main">
${page.body}
  </main>

  <footer class="foot">
    <p>Built and maintained by <a href="https://github.com/AIKitLLC">AI Kit LLC</a> &middot; MIT license &middot; served from ${escapeHtml(info.colo)} (${escapeHtml(info.country)}).</p>
    <p>Independent project, not affiliated with or endorsed by any U.S. government agency. The datasets are works of the U.S. Government, in the public domain (17 U.S.C. &sect; 105), unless a dataset says otherwise.</p>
  </footer>
</div>
${page.script ? `<script nonce="${nonce}">${page.script}</script>` : ""}
</body>
</html>`;
}
