// The analysis engine. Pure functions, no DOM or framework — the UI calls
// `analyze(trackpoints)` and gets back a fully typed, JSON-serializable result.
//
// Pipeline: validate -> cumulative distance -> smooth elevation -> resample
// into fixed-distance buckets -> group contiguous buckets into sections ->
// classify each section.

import { classify, type SectionType } from "./classify";
import { cumulativeDistances } from "./geo";
import type { ProfilePoint, RouteAnalysis, Section, Trackpoint } from "./types";

// --- Tunable constants (kept here so behavior is easy to find and adjust) ---

export const MIN_POINTS = 10;
/** Default segment length for bucketing, meters. */
export const DEFAULT_BUCKET_SIZE_M = 500;
export const ALLOWED_BUCKET_SIZES_M = [250, 500, 1000] as const;
/** Window for the moving-average elevation smoother. */
export const SMOOTH_WINDOW = 5;
/** |grade| at or below this (%) is considered flat/transition. */
export const FLAT_GRADE_THRESHOLD = 2;
/** Sections with drop ≥ this (m) are "significant" for the summary counts. */
export const SIGNIFICANT_DROP_M = 100;
/** Routes shorter than this (km) get an unreliability warning. */
export const SHORT_ROUTE_KM = 1;

const round = (n: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

/**
 * 5-point moving average to damp GPS elevation noise. Returns an array parallel
 * to the input; the two points at each edge keep their original value.
 */
export function smoothElevation(
  ele: readonly number[],
  window = SMOOTH_WINDOW,
): number[] {
  const half = Math.floor(window / 2);
  const n = ele.length;
  return ele.map((value, i) => {
    if (i < half || i >= n - half) return value; // edges unchanged
    let sum = 0;
    for (let j = i - half; j <= i + half; j++) sum += ele[j];
    return sum / window;
  });
}

interface Bucket {
  startKm: number;
  endKm: number;
  eleStart: number;
  eleEnd: number;
  grade: number; // signed %
}

// Linear interpolation of elevation at an arbitrary along-track distance.
// `cursor` is carried across calls because we sample at monotonically
// increasing distances, keeping the whole resample O(n).
function makeSampler(cumDist: readonly number[], ele: readonly number[]) {
  let cursor = 0;
  return (target: number): number => {
    const n = cumDist.length;
    while (cursor < n - 2 && cumDist[cursor + 1] < target) cursor++;
    const d0 = cumDist[cursor];
    const d1 = cumDist[cursor + 1];
    if (d1 <= d0) return ele[cursor];
    const t = Math.min(1, Math.max(0, (target - d0) / (d1 - d0)));
    return ele[cursor] + t * (ele[cursor + 1] - ele[cursor]);
  };
}

function bucketize(
  cumDist: readonly number[],
  smoothed: readonly number[],
  bucketSize: number,
): Bucket[] {
  const totalDist = cumDist[cumDist.length - 1];
  if (totalDist <= 0) return [];
  const sample = makeSampler(cumDist, smoothed);
  const count = Math.ceil(totalDist / bucketSize);
  const buckets: Bucket[] = [];
  for (let b = 0; b < count; b++) {
    const startDist = b * bucketSize;
    const endDist = Math.min((b + 1) * bucketSize, totalDist);
    const eleStart = sample(startDist);
    const eleEnd = sample(endDist);
    const horiz = endDist - startDist;
    buckets.push({
      startKm: startDist / 1000,
      endKm: endDist / 1000,
      eleStart,
      eleEnd,
      grade: horiz > 0 ? ((eleEnd - eleStart) / horiz) * 100 : 0,
    });
  }
  return buckets;
}

function direction(grade: number): SectionType {
  if (grade > FLAT_GRADE_THRESHOLD) return "climb";
  if (grade < -FLAT_GRADE_THRESHOLD) return "descent";
  return "flat";
}

function buildSection(group: Bucket[]): Section {
  const first = group[0];
  const last = group[group.length - 1];
  const type = direction(first.grade);
  const net = last.eleEnd - first.eleStart;
  const distanceKm = last.endKm - first.startKm;
  const horizM = distanceKm * 1000;
  const avgGrade = horizM > 0 ? (net / horizM) * 100 : 0;
  // steepest bucket in the group, keeping its sign
  const maxGrade = group.reduce(
    (steepest, b) => (Math.abs(b.grade) > Math.abs(steepest) ? b.grade : steepest),
    0,
  );
  return {
    type,
    kmStart: round(first.startKm, 3),
    kmEnd: round(last.endKm, 3),
    distanceKm: round(distanceKm, 3),
    elevationStart: round(first.eleStart, 1),
    elevationEnd: round(last.eleEnd, 1),
    drop: round(Math.abs(net), 1),
    avgGrade: round(avgGrade, 1),
    maxGrade: round(maxGrade, 1),
    classification: classify(type, Math.abs(avgGrade)),
  };
}

function groupSections(buckets: Bucket[]): Section[] {
  const sections: Section[] = [];
  let group: Bucket[] = [];
  let groupDir: SectionType | null = null;
  for (const bucket of buckets) {
    const dir = direction(bucket.grade);
    if (groupDir === null || dir === groupDir) {
      group.push(bucket);
      groupDir = dir;
    } else {
      sections.push(buildSection(group));
      group = [bucket];
      groupDir = dir;
    }
  }
  if (group.length > 0) sections.push(buildSection(group));
  return sections;
}

/**
 * Analyze a route. `bucketSize` (meters) controls the section granularity.
 * Throws if there are too few points to say anything useful.
 *
 * TODO: for very large tracks (>20k points) this should run in a Web Worker to
 * keep the UI responsive. Synchronous is fine for typical race GPX files.
 */
export function analyze(
  points: readonly Trackpoint[],
  bucketSize: number = DEFAULT_BUCKET_SIZE_M,
): RouteAnalysis {
  if (points.length < MIN_POINTS) {
    throw new Error(
      `Need at least ${MIN_POINTS} trackpoints to analyze (got ${points.length}).`,
    );
  }

  const cumDist = cumulativeDistances(points);
  const totalDistM = cumDist[cumDist.length - 1];
  const smoothed = smoothElevation(points.map((p) => p.ele));

  // D+/D- and high/low from the smoothed series so GPS jitter doesn't inflate.
  let totalAscent = 0;
  let totalDescent = 0;
  let hiIdx = 0;
  let loIdx = 0;
  for (let i = 0; i < smoothed.length; i++) {
    if (i > 0) {
      const delta = smoothed[i] - smoothed[i - 1];
      if (delta > 0) totalAscent += delta;
      else totalDescent -= delta;
    }
    if (smoothed[i] > smoothed[hiIdx]) hiIdx = i;
    if (smoothed[i] < smoothed[loIdx]) loIdx = i;
  }

  const buckets = bucketize(cumDist, smoothed, bucketSize);
  const sections = groupSections(buckets);

  const profile: ProfilePoint[] = [
    { km: 0, ele: round(smoothed[0], 1), grade: 0 },
    ...buckets.map((b) => ({
      km: round(b.endKm, 3),
      ele: round(b.eleEnd, 1),
      grade: round(b.grade, 1),
    })),
  ];

  const totalDistanceKm = totalDistM / 1000;
  const warnings: string[] = [];
  if (totalDistanceKm < SHORT_ROUTE_KM) {
    warnings.push(
      "This route is under 1 km — section analysis may be unreliable.",
    );
  }

  return {
    totalDistanceKm: round(totalDistanceKm, 2),
    totalAscent: round(totalAscent, 0),
    totalDescent: round(totalDescent, 0),
    highestPoint: { km: round(cumDist[hiIdx] / 1000, 2), ele: round(smoothed[hiIdx], 0) },
    lowestPoint: { km: round(cumDist[loIdx] / 1000, 2), ele: round(smoothed[loIdx], 0) },
    sections,
    profile,
    warnings,
  };
}

/** Count of significant climbs/descents (drop ≥ 100 m) for the summary card. */
export function countSignificant(sections: readonly Section[]): {
  climbs: number;
  descents: number;
} {
  let climbs = 0;
  let descents = 0;
  for (const s of sections) {
    if (s.drop < SIGNIFICANT_DROP_M) continue;
    if (s.type === "climb") climbs++;
    else if (s.type === "descent") descents++;
  }
  return { climbs, descents };
}
