import { describe, it, expect } from "vitest";
import { VpicStore, type AssetReader } from "../../src/vpic/store";

function countingReader(): AssetReader & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    async readText(path: string): Promise<string | null> {
      reads.push(path);
      if (path === "vpic/core.json") {
        return JSON.stringify({ buckets: { wmi: 1024, schema: 4096, spec: 256, catalog: 128 } });
      }
      return JSON.stringify({ schemas: {}, modelMakes: {} }); // 30 bytes
    },
  };
}

describe("VpicStore cache", () => {
  it("evicts the least recently used files once the byte budget is exceeded", async () => {
    const reader = countingReader();
    const store = new VpicStore(reader, 60); // room for two 30-byte files

    await store.getSchemas([1]); // bucket 1
    await store.getSchemas([2]); // bucket 2
    await store.getSchemas([1]); // hit, bucket 1 becomes most recent
    await store.getSchemas([3]); // evicts bucket 2
    expect(store.cachedFiles).toBe(2);

    await store.getSchemas([1]); // still cached
    await store.getSchemas([2]); // was evicted: read again
    const schemaReads = reader.reads.filter((p) => p.startsWith("vpic/schema/"));
    expect(schemaReads).toEqual(["vpic/schema/1.json", "vpic/schema/2.json", "vpic/schema/3.json", "vpic/schema/2.json"]);
  });

  it("reads core.json once and never evicts it", async () => {
    const reader = countingReader();
    const store = new VpicStore(reader, 30);
    await store.getSchemas([1]);
    await store.getSchemas([2]);
    await store.getCore();
    expect(reader.reads.filter((p) => p === "vpic/core.json")).toHaveLength(1);
  });
});
