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

  it("finds exactly one climb followed by one descent", () => {
    const climbs = result.sections.filter((s) => s.type === "climb");
    const descents = result.sections.filter((s) => s.type === "descent");
    expect(climbs).toHaveLength(1);
    expect(descents).toHaveLength(1);
    expect(result.sections[0].type).toBe("climb");
    expect(result.sections.at(-1)?.type).toBe("descent");
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
