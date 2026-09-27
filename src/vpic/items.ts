/**
 * The DecodingItems temp table of spvindecode_core and the orderings the source
 * applies to it (PostgreSQL semantics: in DESC order NULLs sort first).
 */

import type { CoreAsset, DecodingItem, ElementDef } from "./types";

export type NewItem = Omit<DecodingItem, "seq" | "pass">;

export class ItemList {
  private nextSeq = 1;
  items: DecodingItem[] = [];

  constructor(readonly pass: number) {}

  add(item: NewItem): DecodingItem {
    const full: DecodingItem = { ...item, seq: this.nextSeq++, pass: this.pass };
    this.items.push(full);
    return full;
  }

  forElement(elementId: number): DecodingItem[] {
    return this.items.filter((d) => d.elementId === elementId);
  }

  hasElement(elementId: number): boolean {
    return this.items.some((d) => d.elementId === elementId);
  }

  removeWhere(predicate: (item: DecodingItem) => boolean): void {
    this.items = this.items.filter((d) => !predicate(d));
  }
}

/** Comparator for `ORDER BY x DESC` on nullable text: NULLs first, then descending. */
export function nullsFirstDesc(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a > b ? -1 : 1;
}

/** Comparator for `ORDER BY x DESC` on nullable numbers: NULLs first, then descending. */
export function nullsFirstDescNumber(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return b - a;
}

function textAsc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * RANK() order used to keep one item per element:
 *   Priority DESC, CreatedOn DESC, LENGTH(REPLACE(Keys,'*','')) ASC,
 *   REPLACE(REPLACE(Keys,'[',''),']','') ASC, id ASC
 */
export function compareRank(a: DecodingItem, b: DecodingItem): number {
  const keysA = a.keys ?? "";
  const keysB = b.keys ?? "";
  return (
    b.priority - a.priority ||
    nullsFirstDesc(a.createdOn, b.createdOn) ||
    keysA.split("*").join("").length - keysB.split("*").join("").length ||
    textAsc(keysA.replace(/[[\]]/g, ""), keysB.replace(/[[\]]/g, "")) ||
    a.seq - b.seq
  );
}

/** PostgreSQL cast of text to integer: optional surrounding spaces and sign; otherwise null. */
export function pgInt(text: string | null): number | null {
  if (text === null) return null;
  const match = /^\s*([+-]?\d+)\s*$/.exec(text);
  if (!match || match[1] === undefined) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) ? n : null;
}

const elementMaps = new WeakMap<CoreAsset, Map<number, ElementDef>>();

export function elementMap(core: CoreAsset): Map<number, ElementDef> {
  let map = elementMaps.get(core);
  if (!map) {
    map = new Map(core.elements.map((e) => [e.id, e]));
    elementMaps.set(core, map);
  }
  return map;
}
