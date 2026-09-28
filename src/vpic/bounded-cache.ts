/**
 * Insertion-ordered cache with a size limit: reads refresh an entry, and the least
 * recently used entries are dropped once `maxEntries` or `maxWeight` is exceeded.
 * Worker isolates have 128 MB, so every per-isolate cache must be bounded.
 */
export class BoundedCache<K, V> {
  private readonly entries = new Map<K, { value: V; weight: number }>();
  private totalWeight = 0;

  constructor(
    private readonly maxEntries: number,
    private readonly maxWeight: number = Number.POSITIVE_INFINITY
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get weight(): number {
    return this.totalWeight;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  get(key: K): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, weight = 1): void {
    this.delete(key);
    this.entries.set(key, { value, weight });
    this.totalWeight += weight;
    while (this.entries.size > this.maxEntries || (this.totalWeight > this.maxWeight && this.entries.size > 1)) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.delete(oldest.value);
    }
  }

  delete(key: K): void {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.totalWeight -= entry.weight;
    this.entries.delete(key);
  }
}
