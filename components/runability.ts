// UI palette. The chart accent stays boring on purpose — the data should pop.
// Runability maps onto the spec's three-color green/orange/red palette; the
// badge label carries the finer (easy vs moderate) distinction.

import type { Runability } from "@/lib/classify";

/** Chart line accent. */
export const ACCENT = "#185FA5";

const COLORS: Record<Runability, string> = {
  runnable_easy: "#4A8862", // green — runnable
  runnable_mod: "#4A8862",
  tough_run: "#BA7517", // orange — getting hard
  mixed: "#BA7517",
  hike_only: "#993556", // maroon — hike
  very_steep: "#993556",
};

export function runabilityColor(r: Runability): string {
  return COLORS[r];
}

/** Inline styles for a classification badge that read in light and dark mode. */
export function badgeStyle(r: Runability): {
  backgroundColor: string;
  color: string;
  borderColor: string;
} {
  const c = COLORS[r];
  return { backgroundColor: `${c}26`, color: c, borderColor: `${c}59` };
}
