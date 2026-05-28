import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { analyze, countSignificant, smoothElevation } from "../lib/analyzer";
import { parseGpx } from "../lib/gpx";
import type { Trackpoint } from "../lib/types";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, "samples/lavaredo_short.gpx"), "utf8");

describe("smoothElevation", () => {
  it("damps a single-point spike toward its neighbors", () => {
    const data = Array<number>(11).fill(100);
    data[5] = 150; // 50 m GPS noise spike
    const out = smoothElevation(data);
    expect(out[5]).toBeLessThan(150);
    expect(out[5]).toBeGreaterThan(100);
    expect(out[5]).toBeCloseTo(110, 5); // (100+100+150+100+100)/5
  });

  it("leaves the two points at each edge untouched", () => {
    const data = [10, 20, 30, 40, 50, 60, 70];
    const out = smoothElevation(data);
    expect(out[0]).toBe(10);
    expect(out[1]).toBe(20);
    expect(out[out.length - 2]).toBe(60);
    expect(out[out.length - 1]).toBe(70);
  });

  it("is the identity on a clean linear ramp", () => {
    const ramp = [0, 10, 20, 30, 40, 50, 60];
    expect(smoothElevation(ramp)).toEqual(ramp);
  });
});

describe("analyze — end-to-end on the fixture", () => {
  const result = analyze(parseGpx(fixture));

  it("computes total distance (~7.7 km)", () => {
    expect(result.totalDistanceKm).toBeGreaterThan(7.4);
    expect(result.totalDistanceKm).toBeLessThan(8.1);
  });

  it("computes D+ and D- from the smoothed series", () => {
    expect(result.totalAscent).toBe(376);
    expect(result.totalDescent).toBe(356);
  });

  it("identifies a climb-then-descent route (climbs before descents)", () => {
    const climbs = result.sections.filter((s) => s.type === "climb");
    const descents = result.sections.filter((s) => s.type === "descent");
    expect(climbs.length).toBeGreaterThanOrEqual(1);
    expect(descents.length).toBeGreaterThanOrEqual(1);
    expect(result.sections[0].type).toBe("climb");
    expect(result.sections.at(-1)?.type).toBe("descent");
    // every climb starts before every descent
    const lastClimbKm = Math.max(...climbs.map((s) => s.kmStart));
    const firstDescentKm = Math.min(...descents.map((s) => s.kmStart));
    expect(lastClimbKm).toBeLessThan(firstDescentKm);
  });

  it("locates the high point near the 4 km peak", () => {
    expect(result.highestPoint.ele).toBeGreaterThan(1360);
    expect(result.highestPoint.km).toBeGreaterThan(3.5);
    expect(result.highestPoint.km).toBeLessThan(4.2);
  });

  it("counts both sections as significant (drop ≥ 100 m)", () => {
    expect(countSignificant(result.sections)).toEqual({ climbs: 1, descents: 1 });
  });

  it("is warning-free and JSON-serializable for a normal route", () => {
    expect(result.warnings).toEqual([]);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it("produces a profile that starts at km 0", () => {
    expect(result.profile[0].km).toBe(0);
    expect(result.profile.length).toBeGreaterThan(1);
  });
});

describe("analyze — guards and edge cases", () => {
  it("throws when there are too few points", () => {
    const few: Trackpoint[] = Array.from({ length: 5 }, (_, i) => ({
      lat: 0,
      lon: i * 0.001,
      ele: i,
    }));
    expect(() => analyze(few)).toThrow();
  });

  it("warns on a very short route (< 1 km)", () => {
    const pts: Trackpoint[] = Array.from({ length: 12 }, (_, i) => ({
      lat: 0,
      lon: i * 0.0001, // ~11 m per hop → ~120 m total
      ele: 100 + i,
    }));
    expect(analyze(pts).warnings.length).toBeGreaterThan(0);
  });
});

describe("analyze — sub-section splitting by effort level", () => {
  // 0.0009° lon at the equator ≈ 100 m per step, ignoring elevation.
  // First 30 steps gain +5 m each → ~5% (easy effort: runnable_mod).
  // Next 30 steps gain +16 m each → ~16% (steep effort: hike_only).
  // Smoothing softens the boundary; we tolerate a transition section.
  const climbPoints: Trackpoint[] = (() => {
    const pts: Trackpoint[] = [{ lat: 0, lon: 0, ele: 100 }];
    let ele = 100;
    for (let i = 1; i <= 30; i++) {
      ele += 5;
      pts.push({ lat: 0, lon: i * 0.0009, ele });
    }
    for (let i = 31; i <= 60; i++) {
      ele += 16;
      pts.push({ lat: 0, lon: i * 0.0009, ele });
    }
    return pts;
  })();

  it("splits one long climb into multiple sub-sections by effort", () => {
    const r = analyze(climbPoints);
    const climbs = r.sections.filter((s) => s.type === "climb");
    expect(climbs.length).toBeGreaterThanOrEqual(2);
    // The earlier section should be gentler than a later one.
    const first = climbs[0];
    const last = climbs[climbs.length - 1];
    expect(Math.abs(last.avgGrade)).toBeGreaterThan(Math.abs(first.avgGrade));
  });

  it("keeps a single section when the gradient stays in one effort level", () => {
    // Uniform ~6% climb (runnable_mod, easy effort throughout).
    const pts: Trackpoint[] = [{ lat: 0, lon: 0, ele: 100 }];
    let ele = 100;
    for (let i = 1; i <= 40; i++) {
      ele += 6;
      pts.push({ lat: 0, lon: i * 0.0009, ele });
    }
    const climbs = analyze(pts).sections.filter((s) => s.type === "climb");
    expect(climbs).toHaveLength(1);
  });
});
