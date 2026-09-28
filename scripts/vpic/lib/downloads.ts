/**
 * Discovers the newest vPICList_lite dump published on the NHTSA downloads page.
 */

export const DOWNLOADS_URL = "https://vpic.nhtsa.dot.gov/downloads";

const DUMP_LINK_RE = /vPICList_lite_(\d{4})_(\d{2})\.plain\.zip/g;

/**
 * Returns dump names found in the downloads page HTML, newest first.
 */
export function parseDumpNames(html: string): string[] {
  const names = new Set<string>();
  for (const match of html.matchAll(DUMP_LINK_RE)) {
    names.add(`vPICList_lite_${match[1]}_${match[2]}`);
  }
  return [...names].sort().reverse();
}

export async function findLatestDumpName(): Promise<string> {
  const res = await fetch(`${DOWNLOADS_URL}/`, { headers: { "User-Agent": "Mozilla/5.0 nhtsa-edge-api" } });
  if (!res.ok) throw new Error(`Downloads page returned HTTP ${res.status}`);
  const names = parseDumpNames(await res.text());
  const latest = names[0];
  if (!latest) throw new Error("No vPICList_lite_*.plain.zip link found on the downloads page");
  return latest;
}
