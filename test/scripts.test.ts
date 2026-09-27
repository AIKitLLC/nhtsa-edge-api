import { describe, it, expect } from "vitest";
import { mergeModels } from "../scripts/lib/merge";
import { dumpCandidates } from "../scripts/lib/dumps";

describe("Data maintenance helpers", () => {
  it("probes the current month first and walks backwards across years", () => {
    expect(dumpCandidates(new Date("2027-02-10T00:00:00Z"), 4)).toEqual([
      "vPICList_lite_2027_02",
      "vPICList_lite_2027_01",
      "vPICList_lite_2026_12",
      "vPICList_lite_2026_11",
    ]);
  });

  it("merges new models without removing or reordering existing ones", () => {
    expect(mergeModels(["A", "B"], ["B", "C"])).toEqual(["A", "B", "C"]);
    expect(mergeModels(["A", "B"], [])).toEqual(["A", "B"]);
  });
});
