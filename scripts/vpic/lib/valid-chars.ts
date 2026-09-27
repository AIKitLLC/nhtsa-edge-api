/**
 * Aggregates vpic.WMIYearValidChars (8.8M rows: wmi, year, position, char) into one
 * line per (wmi, year): "4:BDEF;5:49AB;...". The live vPIC API validates VIN
 * characters (error codes 2-5) only against this table; when a (wmi, year) pair is
 * missing it reports no position errors. (The PostgreSQL port in the dump falls back
 * to recomputing from patterns instead, which the live API does not do.)
 */

import { decodeCopyField } from "./pg-copy";

export class ValidCharsAccumulator {
  private readonly byKey = new Map<string, Map<number, Set<string>>>();

  add(columns: readonly string[], fields: readonly string[]): void {
    const get = (name: string) => decodeCopyField(fields[columns.indexOf(name)] ?? "\\N");
    const wmi = get("wmi");
    const year = get("year");
    const position = get("position");
    const ch = get("char");
    if (wmi === null || year === null || position === null || ch === null) return;

    const key = `${wmi}\t${year}`;
    let positions = this.byKey.get(key);
    if (!positions) this.byKey.set(key, (positions = new Map()));
    let chars = positions.get(Number(position));
    if (!chars) positions.set(Number(position), (chars = new Set()));
    chars.add(ch);
  }

  /** Sorted TSV rows: wmi, year, "pos:chars;pos:chars" ('_' first, then by character). */
  rows(): string[][] {
    const sortChars = (set: Set<string>) =>
      [...set].sort((a, b) => (a === "_" ? -1 : b === "_" ? 1 : a < b ? -1 : a > b ? 1 : 0)).join("");
    return [...this.byKey.entries()]
      .map(([key, positions]) => {
        const [wmi = "", year = ""] = key.split("\t");
        const chars = [...positions.entries()]
          .sort(([a], [b]) => a - b)
          .map(([pos, set]) => `${pos}:${sortChars(set)}`)
          .join(";");
        return [wmi, year, chars];
      })
      .sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? "") || Number(a[1]) - Number(b[1]));
  }

  get size(): number {
    return this.byKey.size;
  }
}

/** Parses "4:BDEF;5:49AB" into { 4: "BDEF", 5: "49AB" }. */
export function parseValidChars(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of text.split(";")) {
    const idx = part.indexOf(":");
    if (idx > 0) out[part.substring(0, idx)] = part.substring(idx + 1);
  }
  return out;
}
