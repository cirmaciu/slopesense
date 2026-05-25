import { describe, expect, it } from "vitest";

import { cumulativeDistances, haversine } from "../lib/geo";
import type { Trackpoint } from "../lib/types";

describe("haversine", () => {
  it("matches the Prague→Vienna golden distance (~252 km)", () => {
    const prague = { lat: 50.0755, lon: 14.4378 };
    const vienna = { lat: 48.2082, lon: 16.3738 };
    const km = haversine(prague, vienna) / 1000;
    expect(km).toBeGreaterThan(248);
    expect(km).toBeLessThan(256);
  });

  it("is zero for identical points", () => {
    expect(haversine({ lat: 1, lon: 2 }, { lat: 1, lon: 2 })).toBe(0);
  });
});

describe("cumulativeDistances", () => {
  it("accumulates evenly along a straight equatorial line", () => {
    // 0.001° lon at the equator ≈ 111.2 m; three equal hops.
    const pts: Trackpoint[] = [
      { lat: 0, lon: 0, ele: 0 },
      { lat: 0, lon: 0.001, ele: 0 },
      { lat: 0, lon: 0.002, ele: 0 },
      { lat: 0, lon: 0.003, ele: 0 },
    ];
    const d = cumulativeDistances(pts);
    expect(d[0]).toBe(0);
    expect(d[1]).toBeCloseTo(111.2, 0);
    expect(d[2]).toBeCloseTo(222.4, 0);
    expect(d[3]).toBeCloseTo(333.6, 0);
    expect(d[2] - d[1]).toBeCloseTo(d[1] - d[0], 5);
  });

  it("returns [] for empty input", () => {
    expect(cumulativeDistances([])).toEqual([]);
  });
});
