#!/usr/bin/env bun
/**
 * Builds the Worker's static Form 144 assets (build/assets/form144/...) from data/form144.
 * The ingest already writes the served shape, so this is a copy. Independent of
 * scripts/vpic/build-assets.ts, which only clears its own build/assets/vpic.
 * A missing data/form144 is not an error: the endpoint then answers 404 for everything.
 *
 * Usage: bun scripts/form144/build-assets.ts [--data=data/form144] [--out=build/assets]
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { FORM144_MANIFEST_PATH, form144DayPath } from "../../src/form144/store";

/** Copies the manifest and every day file; returns how many files were copied. */
export function copyAssets(dataDir: string, outDir: string): number {
  let copied = 0;
  const copy = (srcRel: string, targetRel: string) => {
    const target = join(outDir, targetRel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(dataDir, srcRel), target);
    copied++;
  };
  if (!existsSync(join(dataDir, "manifest.json"))) return 0;
  copy("manifest.json", FORM144_MANIFEST_PATH);
  const daysDir = join(dataDir, "days");
  for (const file of readdirSync(daysDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
    copy(join("days", file), form144DayPath(file.replace(/\.json$/, "")));
  }
  return copied;
}

if (import.meta.main) {
  const arg = (name: string, fallback: string): string =>
    process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const root = resolve(import.meta.dirname ?? ".", "../..");
  const copied = copyAssets(resolve(root, arg("data", "data/form144")), resolve(root, arg("out", "build/assets")));
  console.log(copied === 0 ? "form144: no data/form144, nothing to build" : `form144: ${copied} files`);
}
