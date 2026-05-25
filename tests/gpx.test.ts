import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { GpxError, parseGpx, parseGpxName } from "../lib/gpx";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, "samples/lavaredo_short.gpx"), "utf8");

// Tiny GPX builders for the synthetic cases.
const pt = (lat: number, lon: number, ele?: number): string =>
  ele === undefined
    ? `<trkpt lat="${lat}" lon="${lon}"/>`
    : `<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`;

const wrap = (segments: string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>` +
  `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">` +
  `<trk><name>synthetic</name>` +
  segments.map((s) => `<trkseg>${s}</trkseg>`).join("") +
  `</trk></gpx>`;

describe("parseGpx", () => {
  it("parses every trackpoint from the fixture", () => {
    const pts = parseGpx(fixture);
    expect(pts).toHaveLength(40);
    expect(pts[0]).toEqual({ lat: 46.6, lon: 12.3, ele: 1000 });
  });

  it("concatenates points across multiple <trkseg>", () => {
    const segA = Array.from({ length: 6 }, (_, i) => pt(46.6, 12.3 + i * 0.001, 1000 + i)).join("");
    const segB = Array.from({ length: 6 }, (_, i) => pt(46.6, 12.31 + i * 0.001, 1010 + i)).join("");
    const pts = parseGpx(wrap([segA, segB]));
    expect(pts).toHaveLength(12);
  });

  it("rejects a GPX with no elevation data", () => {
    const seg = Array.from({ length: 12 }, (_, i) => pt(46.6, 12.3 + i * 0.001)).join("");
    expect(() => parseGpx(wrap([seg]))).toThrow(GpxError);
    expect(() => parseGpx(wrap([seg]))).toThrow(/no elevation data/i);
  });

  it("rejects a GPX with too few points", () => {
    const seg = Array.from({ length: 5 }, (_, i) => pt(46.6, 12.3 + i * 0.001, 1000 + i)).join("");
    expect(() => parseGpx(wrap([seg]))).toThrow(/too few/i);
  });

  it("rejects a GPX with no track points at all", () => {
    expect(() => parseGpx(wrap([""]))).toThrow(/no track points/i);
  });

  it("forward- and back-fills sparse missing elevations", () => {
    const seg = [
      pt(0, 0.0), // no ele -> back-filled from first known (100)
      pt(0, 0.001, 100),
      pt(0, 0.002), // -> carried 100
      pt(0, 0.003, 130),
      ...Array.from({ length: 8 }, (_, i) => pt(0, 0.004 + i * 0.001)), // -> carried 130
    ].join("");
    const pts = parseGpx(wrap([seg]));
    expect(pts).toHaveLength(12);
    expect(pts[0].ele).toBe(100);
    expect(pts[2].ele).toBe(100);
    expect(pts[3].ele).toBe(130);
    expect(pts.at(-1)?.ele).toBe(130);
  });

  it("throws GpxError on malformed XML", () => {
    expect(() => parseGpx("<gpx><trk>")).toThrow(GpxError);
  });
});

describe("parseGpxName", () => {
  it("reads the track name from the fixture", () => {
    expect(parseGpxName(fixture)).toBe("Lavaredo Short (test fixture)");
  });

  it("returns undefined when no name is present", () => {
    const seg = Array.from({ length: 12 }, (_, i) => pt(0, i * 0.001, 100 + i)).join("");
    const xml = `<gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${seg}</trkseg></trk></gpx>`;
    expect(parseGpxName(xml)).toBeUndefined();
  });
});
