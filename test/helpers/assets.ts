/**
 * A Fetcher over the real build output (build/assets), standing in for the
 * Worker's ASSETS binding in tests. Run `pnpm build:data` first.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ASSETS_DIR = resolve(__dirname, "../../build/assets");

export function hasBuiltAssets(): boolean {
  return existsSync(join(ASSETS_DIR, "vpic/core.json"));
}

export function fsAssets(root: string = ASSETS_DIR): Fetcher {
  return {
    async fetch(input: RequestInfo | URL): Promise<Response> {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const file = join(root, decodeURIComponent(url.pathname));
      if (!file.startsWith(root) || !existsSync(file)) return new Response("Not Found", { status: 404 });
      return new Response(readFileSync(file), { headers: { "Content-Type": "application/json" } });
    },
    connect(): never {
      throw new Error("not supported");
    },
  } as unknown as Fetcher;
}

export const testEnv = () => ({ ASSETS: fsAssets() });
