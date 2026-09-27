/**
 * Builds the vPIC assets from data/vpic once when they are missing, so the suite
 * always runs against the real committed dataset.
 */

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export default function setup(): void {
  const root = resolve(__dirname, "..");
  if (existsSync(resolve(root, "build/assets/vpic/core.json"))) return;
  execFileSync("bun", ["scripts/vpic/build-assets.ts"], { cwd: root, stdio: "inherit" });
}
