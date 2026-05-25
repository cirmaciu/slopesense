import { describe, expect, it } from "vitest";

import {
  classificationLabel,
  classify,
  classifyClimb,
  classifyDescent,
  strategyHint,
  type Runability,
} from "../lib/classify";

const ALL: Runability[] = [
  "runnable_easy",
  "runnable_mod",
  "tough_run",
  "mixed",
  "hike_only",
  "very_steep",
];

describe("classifyDescent thresholds", () => {
  it("classifies each boundary", () => {
    expect(classifyDescent(0)).toBe("runnable_easy");
    expect(classifyDescent(4.9)).toBe("runnable_easy");
    expect(classifyDescent(5)).toBe("runnable_mod");
    expect(classifyDescent(7.9)).toBe("runnable_mod");
    expect(classifyDescent(8)).toBe("tough_run");
    expect(classifyDescent(11.9)).toBe("tough_run");
    expect(classifyDescent(12)).toBe("mixed");
    expect(classifyDescent(14.9)).toBe("mixed");
    expect(classifyDescent(15)).toBe("hike_only");
    expect(classifyDescent(19.9)).toBe("hike_only");
    expect(classifyDescent(20)).toBe("very_steep");
    expect(classifyDescent(40)).toBe("very_steep");
  });
});

describe("classifyClimb thresholds", () => {
  it("classifies each boundary (stricter than descents)", () => {
    expect(classifyClimb(3.9)).toBe("runnable_easy");
    expect(classifyClimb(4)).toBe("runnable_mod");
    expect(classifyClimb(6.9)).toBe("runnable_mod");
    expect(classifyClimb(7)).toBe("tough_run");
    expect(classifyClimb(9.9)).toBe("tough_run");
    expect(classifyClimb(10)).toBe("mixed");
    expect(classifyClimb(13.9)).toBe("mixed");
    expect(classifyClimb(14)).toBe("hike_only");
    expect(classifyClimb(19.9)).toBe("hike_only");
    expect(classifyClimb(20)).toBe("very_steep");
  });

  it("a moderate grade is judged differently up vs down", () => {
    expect(classifyClimb(4.5)).toBe("runnable_mod");
    expect(classifyDescent(4.5)).toBe("runnable_easy");
  });
});

describe("classify dispatch", () => {
  it("treats flats as easy regardless of grade", () => {
    expect(classify("flat", 50)).toBe("runnable_easy");
  });

  it("routes to the climb/descent tables", () => {
    expect(classify("climb", 12)).toBe("mixed");
    expect(classify("descent", 12)).toBe("mixed");
    expect(classify("climb", 8)).toBe("tough_run");
    expect(classify("descent", 8)).toBe("tough_run");
  });
});

describe("copy completeness", () => {
  it("has a non-empty label and strategy for every classification", () => {
    for (const r of ALL) {
      expect(classificationLabel(r).length).toBeGreaterThan(0);
      expect(strategyHint("climb", r).length).toBeGreaterThan(0);
      expect(strategyHint("descent", r).length).toBeGreaterThan(0);
    }
    expect(strategyHint("flat", "runnable_easy").length).toBeGreaterThan(0);
  });
});
