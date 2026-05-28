// UI palette. The chart accent stays boring on purpose — the data should pop.
// Runability maps onto the spec's three-color green/orange/red palette; the
// badge label carries the finer (easy vs moderate) distinction.

import { effortLevel, type EffortLevel, type Runability } from "@/lib/classify";

/** Chart line accent. */
export const ACCENT = "#185FA5";

const EFFORT_COLORS: Record<EffortLevel, string> = {
  easy: "#4A8862", // green — runnable
  mid: "#BA7517", // orange — getting hard
  steep: "#993556", // maroon — hike
};

export function runabilityColor(r: Runability): string {
  return EFFORT_COLORS[effortLevel(r)];
}

/** Inline styles for a classification badge that read in light and dark mode. */
export function badgeStyle(r: Runability): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const c = runabilityColor(r);
  return { backgroundColor: `${c}26`, color: c, borderColor: `${c}59` };
}
