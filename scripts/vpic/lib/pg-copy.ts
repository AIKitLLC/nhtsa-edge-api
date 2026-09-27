/**
 * Streaming reader for the `COPY ... FROM stdin;` blocks of a PostgreSQL plain-SQL dump.
 * Fields stay in COPY text encoding (\N for NULL, backslash escapes), which is also
 * the encoding of the TSV files written to data/vpic.
 */

import type { Readable } from "node:stream";

export interface CopyBlockHeader {
  readonly table: string; // e.g. "pattern" (schema prefix removed)
  readonly columns: readonly string[];
}

const COPY_RE = /^COPY\s+(?:[a-z_]+\.)?"?([a-z0-9_]+)"?\s+\(([^)]*)\)\s+FROM stdin;$/i;

export function parseCopyHeader(line: string): CopyBlockHeader | null {
  const match = COPY_RE.exec(line);
  if (!match || !match[1] || match[2] === undefined) return null;
  const columns = match[2].split(",").map((c) => c.trim().replace(/^"|"$/g, "").toLowerCase());
  return { table: match[1].toLowerCase(), columns };
}

/**
 * Yields the lines of a byte stream (LF-separated, UTF-8). Reads chunks directly
 * instead of node:readline, whose async iterator can close early under Bun.
 */
export async function* readLines(input: Readable): AsyncGenerator<string> {
  const decoder = new TextDecoder("utf-8");
  let pending = "";
  for await (const chunk of input) {
    pending += typeof chunk === "string" ? chunk : decoder.decode(chunk as Uint8Array, { stream: true });
    let start = 0;
    let newline = pending.indexOf("\n", start);
    while (newline >= 0) {
      const end = newline > start && pending.charCodeAt(newline - 1) === 13 ? newline - 1 : newline;
      yield pending.slice(start, end);
      start = newline + 1;
      newline = pending.indexOf("\n", start);
    }
    pending = pending.slice(start);
  }
  pending += decoder.decode();
  if (pending !== "") yield pending;
}

/**
 * Calls `onRow` for every row of every COPY block. `wanted` limits which tables are
 * parsed; other blocks are skipped without splitting their lines.
 */
export async function readCopyBlocks(
  input: Readable,
  wanted: (table: string) => boolean,
  onRow: (header: CopyBlockHeader, fields: string[]) => void
): Promise<Set<string>> {
  const seen = new Set<string>();
  let current: CopyBlockHeader | null = null;
  let skipping = false;
  let unterminated: string | null = null;

  for await (const line of readLines(input)) {
    if (current || skipping) {
      if (line === "\\.") {
        current = null;
        skipping = false;
        unterminated = null;
        continue;
      }
      if (current) onRow(current, line.split("\t"));
      continue;
    }

    if (line.startsWith("COPY ")) {
      const header = parseCopyHeader(line);
      if (!header) throw new Error(`Unrecognized COPY header: ${line.slice(0, 120)}`);
      seen.add(header.table);
      unterminated = header.table;
      if (wanted(header.table)) {
        current = header;
      } else {
        skipping = true;
      }
    }
  }

  if (unterminated !== null) {
    throw new Error(`Dump ended inside the COPY block of '${unterminated}' (truncated file?)`);
  }
  return seen;
}

/**
 * Decodes one COPY text field to its value (null for \N).
 */
export function decodeCopyField(field: string): string | null {
  if (field === "\\N") return null;
  if (!field.includes("\\")) return field;
  return field.replace(/\\(.)/g, (_m, ch: string) => {
    switch (ch) {
      case "t":
        return "\t";
      case "n":
        return "\n";
      case "r":
        return "\r";
      case "b":
        return "\b";
      case "f":
        return "\f";
      case "v":
        return "\v";
      default:
        return ch;
    }
  });
}

/**
 * Encodes a value back to COPY text encoding.
 */
export function encodeCopyField(value: string | null): string {
  if (value === null) return "\\N";
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

/**
 * Normalizes a PostgreSQL timestamp ("2015-03-04 10:36:56.78") to a fixed-width,
 * lexicographically sortable form with millisecond precision ("2015-03-04 10:36:56.780").
 */
export function normalizeTimestamp(value: string | null): string | null {
  if (value === null) return null;
  const match = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?$/.exec(value);
  if (!match || !match[1]) throw new Error(`Unexpected timestamp format: ${value}`);
  const fraction = (match[2] ?? "").padEnd(3, "0").slice(0, 3);
  return `${match[1]}.${fraction}`;
}
