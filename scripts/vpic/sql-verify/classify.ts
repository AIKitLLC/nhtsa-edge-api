/**
 * Which port-vs-PostgreSQL differences are deliberate (the port follows the live
 * SQL Server API there) and which are bugs.
 *
 *   conversion: values computed by vpic.Conversion formulas. The port uses T-SQL
 *               decimal arithmetic (src/vpic/tsql-decimal.ts), PostgreSQL numeric
 *               rounds differently; accepted when both are numbers within 1e-6 (relative).
 *
 *   erratum-E1: VINs whose descriptor is listed in vpic.VinDescriptor. The dump's
 *               spvindecode never applies these overrides (docs/NHTSA-ERRATA.md);
 *               the port applies them like the live API, so the whole decode may differ.
 *
 * Valid-character checks (the other deliberate difference) are neutralised in the
 * database instead, see schema.ts (cacheOnlySql).
 */

import { vinDescriptor } from "../../../src/vpic/vin-functions";
import type { CorpusEntry } from "../lib/corpus";
import type { FieldDiff } from "./compare";

export type Category = "conversion" | "erratum-E1" | "unexpected";

export interface Context {
  readonly conversionTargets: ReadonlySet<number>;
  readonly vinDescriptors: ReadonlySet<string>;
}

function closeNumbers(a: string, b: string): boolean {
  if (a === "" || b === "") return false;
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
}

export function classify(entry: CorpusEntry, diffs: readonly FieldDiff[], ctx: Context): FieldDiff[] {
  const e1 = ctx.vinDescriptors.has(vinDescriptor(entry.vin.trim().toUpperCase()));
  return diffs.map((d) => {
    if (e1) return { ...d, category: "erratum-E1" };
    if (ctx.conversionTargets.has(d.elementId) && closeNumbers(d.sql, d.port)) return { ...d, category: "conversion" };
    return d;
  });
}
