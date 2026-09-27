/**
 * VpicStore backed by the Worker's static assets binding. A single store per isolate,
 * so parsed asset files are reused across requests.
 */

import { VpicStore, type AssetReader } from "./store";

// Any origin works: the ASSETS binding only looks at the path.
const ASSET_ORIGIN = "https://assets.invalid/";

let currentAssets: Fetcher | null = null;
let store: VpicStore | null = null;

const reader: AssetReader = {
  async readText(path: string): Promise<string | null> {
    if (!currentAssets) throw new Error("ASSETS binding not configured");
    const res = await currentAssets.fetch(new Request(`${ASSET_ORIGIN}${path}`));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Asset ${path}: HTTP ${res.status}`);
    return res.text();
  },
};

export function getVpicStore(assets: Fetcher): VpicStore {
  currentAssets = assets;
  store ??= new VpicStore(reader);
  return store;
}
