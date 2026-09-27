/**
 * AssetReader over the build output on disk (tests, parity checks, CLI).
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetReader } from "../../../src/vpic/store";

export function fsAssetReader(root: string): AssetReader {
  return {
    async readText(path: string): Promise<string | null> {
      const full = join(root, path);
      if (!existsSync(full)) return null;
      return readFileSync(full, "utf-8");
    },
  };
}
