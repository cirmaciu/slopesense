// Geographic distance helpers. Pure, no DOM, no framework.

import type { Trackpoint } from "./types";

export interface LatLon {
  lat: number;
  lon: number;
}

// Mean Earth radius (meters). Good to ~0.5% for our purposes.
const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Great-circle distance between two coordinates, in meters. */
export function haversine(a: LatLon, b: LatLon): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  // clamp guards against tiny FP overshoot above 1 inside asin
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Cumulative along-track distance in meters, parallel to `points`.
 * First element is always 0. Elevation is ignored (planar distance).
 */
export function cumulativeDistances(points: readonly Trackpoint[]): number[] {
  if (points.length === 0) return [];
  const out = new Array<number>(points.length);
  out[0] = 0;
  for (let i = 1; i < points.length; i++) {
    out[i] = out[i - 1] + haversine(points[i - 1], points[i]);
  }
  return out;
}
