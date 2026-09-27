/**
 * Read access to the pre-built vPIC assets, with an in-isolate cache.
 * In the Worker the reader is backed by the ASSETS binding; tests and scripts
 * use a filesystem reader over the same build output.
 */

import { BoundedCache } from "./bounded-cache";
import type { CoreAsset, SchemaBucket, SchemaRecord, SpecBucket, SpecSchema, WmiBucket, WmiRecord } from "./types";

export interface AssetReader {
  /** Returns the text of the asset at `path` (e.g. "vpic/core.json"), or null when absent. */
  readText(path: string): Promise<string | null>;
}

/** Stable string hash (FNV-1a 32-bit) used to spread WMIs over bucket files. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export const wmiBucketPath = (wmi: string, buckets: number): string => `vpic/wmi/${fnv1a(wmi) % buckets}.json`;
export const schemaBucketPath = (schemaId: number, buckets: number): string => `vpic/schema/${schemaId % buckets}.json`;
export const specBucketPath = (makeId: number, buckets: number): string => `vpic/spec/${makeId % buckets}.json`;
export const catalogModelsPath = (makeId: number, buckets: number): string => `vpic/catalog/models/${makeId % buckets}.json`;

export interface CatalogEntry {
  readonly id: number;
  readonly name: string;
}

export class AssetNotFoundError extends Error {
  constructor(path: string) {
    super(`vPIC asset missing: ${path}`);
    this.name = "AssetNotFoundError";
  }
}

/**
 * Parsed asset files kept per isolate. The whole dataset (~135 MB of JSON) does not
 * fit in a Worker's 128 MB, so the least recently used files are evicted once their
 * JSON text exceeds this budget (parsed objects take a few times the text size).
 */
export const DEFAULT_CACHE_BUDGET_BYTES = 4 * 1024 * 1024; // ~42 MB heap measured over 3,000 varied VINs
const MAX_CACHED_FILES = 2000;

export class VpicStore {
  private core: Promise<CoreAsset> | null = null;
  private readonly files: BoundedCache<string, Promise<unknown>>;

  constructor(
    private readonly reader: AssetReader,
    cacheBudgetBytes: number = DEFAULT_CACHE_BUDGET_BYTES
  ) {
    this.files = new BoundedCache(MAX_CACHED_FILES, cacheBudgetBytes);
  }

  /** Number of asset files currently cached (excluding core.json). */
  get cachedFiles(): number {
    return this.files.size;
  }

  /** JSON text size of the cached files. */
  get cachedBytes(): number {
    return this.files.weight;
  }

  private async readJson<T>(path: string): Promise<{ value: T; bytes: number } | null> {
    const text = await this.reader.readText(path);
    return text === null ? null : { value: JSON.parse(text) as T, bytes: text.length };
  }

  private load<T>(path: string, required: boolean): Promise<T | null> {
    const cached = this.files.get(path) as Promise<T | null> | undefined;
    if (cached) return cached;

    const pending = this.readJson<T>(path).then((result) => {
      if (result === null) {
        if (required) throw new AssetNotFoundError(path);
        return null;
      }
      // Weigh the entry once its size is known (only if it was not evicted meanwhile)
      if (this.files.has(path)) this.files.set(path, pending, result.bytes);
      return result.value;
    });
    // Failed loads are not cached, so a transient error does not stick
    pending.catch(() => this.files.delete(path));
    this.files.set(path, pending, 0);
    return pending;
  }

  /** core.json is needed by every decode; it is held outside the LRU. */
  getCore(): Promise<CoreAsset> {
    if (!this.core) {
      const pending = this.readJson<CoreAsset>("vpic/core.json").then((c) => {
        if (c === null) throw new AssetNotFoundError("vpic/core.json");
        return c.value;
      });
      pending.catch(() => (this.core = null));
      this.core = pending;
    }
    return this.core;
  }

  async getWmi(wmi: string): Promise<WmiRecord | null> {
    const core = await this.getCore();
    const bucket = await this.load<WmiBucket>(wmiBucketPath(wmi, core.buckets.wmi), false);
    return bucket?.[wmi] ?? null;
  }

  async getSchemas(ids: Iterable<number>): Promise<Map<number, SchemaRecord>> {
    const core = await this.getCore();
    const unique = [...new Set(ids)];
    const paths = [...new Set(unique.map((id) => schemaBucketPath(id, core.buckets.schema)))];
    const buckets = await Promise.all(paths.map((p) => this.load<SchemaBucket>(p, true)));
    const byPath = new Map(paths.map((p, i) => [p, buckets[i] ?? null]));

    const result = new Map<number, SchemaRecord>();
    for (const id of unique) {
      const record = byPath.get(schemaBucketPath(id, core.buckets.schema))?.schemas[String(id)];
      if (record) result.set(id, record);
    }
    return result;
  }

  /** Makes of a model (Make_Model), looked up in the bucket of the schema that set it. */
  async getModelMakes(schemaId: number, modelId: number): Promise<readonly (readonly [number, string])[]> {
    const core = await this.getCore();
    const bucket = await this.load<SchemaBucket>(schemaBucketPath(schemaId, core.buckets.schema), true);
    return bucket?.modelMakes[String(modelId)] ?? [];
  }

  getMakes(): Promise<readonly CatalogEntry[]> {
    return this.load<CatalogEntry[]>("vpic/catalog/makes.json", true).then((m) => m ?? []);
  }

  /** Models of every make whose name equals `makeName` (case-insensitive). */
  async getModelsForMake(makeName: string): Promise<{ make: CatalogEntry; models: readonly CatalogEntry[] }[]> {
    const core = await this.getCore();
    const wanted = makeName.trim().toUpperCase();
    const makes = (await this.getMakes()).filter((m) => m.name.trim().toUpperCase() === wanted);
    return Promise.all(
      makes.map(async (make) => {
        const bucket = await this.load<Record<string, CatalogEntry[]>>(catalogModelsPath(make.id, core.buckets.catalog), false);
        return { make, models: bucket?.[String(make.id)] ?? [] };
      })
    );
  }

  async getSpecSchemas(makeIds: Iterable<number>): Promise<SpecSchema[]> {
    const core = await this.getCore();
    const unique = [...new Set(makeIds)];
    const out: SpecSchema[] = [];
    for (const makeId of unique) {
      const bucket = await this.load<SpecBucket>(specBucketPath(makeId, core.buckets.spec), false);
      out.push(...(bucket?.byMake[String(makeId)] ?? []));
    }
    return out;
  }
}
