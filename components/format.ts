// Small display formatters shared across the result components.

const nf = new Intl.NumberFormat("en-US");

/** Whole meters with a thousands separator, e.g. "1,376 m". */
export const fmtMeters = (m: number): string => `${nf.format(Math.round(m))} m`;

/** One decimal km, e.g. "7.7 km". */
export const fmtKm = (km: number): string => `${km.toFixed(1)} km`;

/** Signed percent grade, e.g. "+5.2%" / "-9.0%". */
export const fmtGrade = (pct: number): string =>
  `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;

/** Race-order km range, e.g. "3.5–4.0 km". */
export const fmtKmRange = (a: number, b: number): string =>
  `${a.toFixed(1)}–${b.toFixed(1)} km`;
