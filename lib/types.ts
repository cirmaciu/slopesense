// Shared domain types. Everything here is plain JSON-serializable data so a
// RouteAnalysis can later be persisted, shared, or sent over MCP unchanged.

import type { Runability, SectionType } from "./classify";

export interface Trackpoint {
  lat: number;
  lon: number;
  ele: number; // meters
}

export interface Section {
  type: SectionType;
  kmStart: number; // km from start
  kmEnd: number;
  distanceKm: number; // kmEnd - kmStart
  elevationStart: number; // m
  elevationEnd: number; // m
  drop: number; // always positive, m (gain for climbs, loss for descents)
  avgGrade: number; // signed, %
  maxGrade: number; // signed, % (steepest bucket in the section)
  classification: Runability;
}

export interface ProfilePoint {
  km: number;
  ele: number; // m
  grade: number; // signed %, computed over the preceding bucket
}

export interface RouteAnalysis {
  totalDistanceKm: number;
  totalAscent: number; // D+, m
  totalDescent: number; // D-, m
  highestPoint: { km: number; ele: number };
  lowestPoint: { km: number; ele: number };
  sections: Section[]; // all, including flats, in race order
  profile: ProfilePoint[]; // sampled per bucket for the chart
  warnings: string[]; // non-fatal advisories (e.g. very short route)
}
