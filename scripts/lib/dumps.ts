/**
 * NHTSA vPICList dump naming helpers.
 */

/**
 * Candidate dump names for the current month and the previous months, newest first
 * (e.g. vPICList_lite_2026_09, vPICList_lite_2026_08, ...).
 */
export function dumpCandidates(now: Date, months: number): string[] {
  const names: string[] = [];
  for (let offset = 0; offset < months; offset++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    names.push(`vPICList_lite_${d.getUTCFullYear()}_${mm}`);
  }
  return names;
}
