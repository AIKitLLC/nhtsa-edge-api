/**
 * Pure catalog merge logic (no Node APIs, so it is unit-testable from the worker test suite).
 */

/**
 * Adds models the catalog does not know yet, keeping existing order.
 * Never removes models: a partial or failed upstream answer must not shrink the catalog.
 */
export function mergeModels(existing: readonly string[], fetched: readonly string[]): string[] {
  const known = new Set(existing);
  return [...existing, ...fetched.filter((m) => !known.has(m))];
}
