// Runability classification rules + strategy hints.
//
// This is the single place to tune how the app judges terrain, so the
// thresholds and the prose that depends on them live together. Pure and
// framework-free — safe to import anywhere (browser, tests, future MCP/server).

export type Runability =
  | "runnable_easy"
  | "runnable_mod"
  | "tough_run"
  | "mixed"
  | "hike_only"
  | "very_steep";

export type SectionType = "climb" | "descent" | "flat";

// Asymmetric thresholds — the same gradient feels very different going up vs
// down. `absGrade` is the section's average gradient magnitude in percent.

export function classifyDescent(absGrade: number): Runability {
  if (absGrade < 5) return "runnable_easy";
  if (absGrade < 8) return "runnable_mod";
  if (absGrade < 12) return "tough_run";
  if (absGrade < 15) return "mixed";
  if (absGrade < 20) return "hike_only";
  return "very_steep";
}

export function classifyClimb(absGrade: number): Runability {
  if (absGrade < 4) return "runnable_easy";
  if (absGrade < 7) return "runnable_mod";
  if (absGrade < 10) return "tough_run";
  if (absGrade < 14) return "mixed";
  if (absGrade < 20) return "hike_only";
  return "very_steep";
}

/** Dispatch classification by section direction. Flats are always easy. */
export function classify(type: SectionType, absGrade: number): Runability {
  if (type === "descent") return classifyDescent(absGrade);
  if (type === "climb") return classifyClimb(absGrade);
  return "runnable_easy";
}

/** Three-level effort grouping that mirrors the chart's color palette. */
export type EffortLevel = "easy" | "mid" | "steep";

const EFFORT_OF: Record<Runability, EffortLevel> = {
  runnable_easy: "easy",
  runnable_mod: "easy",
  tough_run: "mid",
  mixed: "mid",
  hike_only: "steep",
  very_steep: "steep",
};

/** Map a 6-level runability onto the 3-level effort scale used for coloring
 * and for splitting long sections into runnable / mixed / hike sub-sections. */
export function effortLevel(r: Runability): EffortLevel {
  return EFFORT_OF[r];
}

const LABELS: Record<Runability, string> = {
  runnable_easy: "Runnable",
  runnable_mod: "Runnable (mod)",
  tough_run: "Tough run",
  mixed: "Mixed run/hike",
  hike_only: "Hike",
  very_steep: "Very steep",
};

/** Short human label for a badge. */
export function classificationLabel(r: Runability): string {
  return LABELS[r];
}

// Strategy hints are intentionally hardcoded per (direction, classification).
// One sentence each, written for a trail runner doing race recon. Keep it
// concrete and tactical — don't try to be clever here (per spec).

const FLAT_HINT = "Flat to rolling — settle into goal pace and fuel here.";

const DESCENT_HINTS: Record<Runability, string> = {
  runnable_easy: "Open it up — relax, quick light cadence, let gravity carry you.",
  runnable_mod: "Run controlled — short strides, stay loose, watch your footing.",
  tough_run: "Runnable but it bites — brake early and protect the quads for later.",
  mixed: "Mix running and braking; shorten your stride hard on the steeper steps.",
  hike_only: "Too steep to run efficiently — descend in control, work the terrain.",
  very_steep:
    "Power-hike down with poles — > 20% sustained will destroy the quads if you run it.",
};

const CLIMB_HINTS: Record<Runability, string> = {
  runnable_easy: "Runnable climb — keep it aerobic, shorten the stride a touch.",
  runnable_mod: "Run the mellow bits, hike the kicks — keep the effort even.",
  tough_run: "On the edge of runnable — strong hikers save energy power-hiking.",
  mixed: "Power-hike most of it; only run where the grade clearly eases.",
  hike_only: "Power-hike, hands on knees or poles — running here wastes energy.",
  very_steep: "Steep grind — poles, short steps, steady rhythm, manage the heart rate.",
};

/** One-sentence pacing strategy for a section. */
export function strategyHint(type: SectionType, r: Runability): string {
  if (type === "flat") return FLAT_HINT;
  return type === "descent" ? DESCENT_HINTS[r] : CLIMB_HINTS[r];
}
