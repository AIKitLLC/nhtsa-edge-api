/**
 * Strips empty strings, nulls, undefined, and "Not Applicable" entries from an object
 * (used by the VPIC proxy's `clean=true` option).
 */
export function cleanEmptyFields<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed.toLowerCase() === "not applicable") {
        continue;
      }
      result[key] = trimmed;
    } else {
      result[key] = value;
    }
  }

  return result;
}
