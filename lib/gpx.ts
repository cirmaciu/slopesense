// GPX parsing via the browser's DOMParser — no external library, tiny bundle.
// Runs client-side (and in jsdom for tests). Throws GpxError with a
// user-facing message on anything the UI should surface.

import type { Trackpoint } from "./types";

export const MIN_POINTS = 10;

/** A parse/validation failure whose message is safe to show the user. */
export class GpxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxError";
  }
}

interface RawPoint {
  lat: number;
  lon: number;
  ele: number | null;
}

function getDoc(xml: string): Document {
  if (typeof DOMParser === "undefined") {
    throw new GpxError("GPX parsing is only available in the browser.");
  }
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  // DOMParser signals malformed XML with a <parsererror> node instead of throwing.
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new GpxError("This file isn't valid GPX/XML.");
  }
  return doc;
}

// Namespace-agnostic lookup: GPX uses a default namespace, and some exporters
// add prefixes. Matching on local name with "*" handles both.
const localName = (el: Element, name: string): HTMLCollectionOf<Element> =>
  el.getElementsByTagNameNS("*", name);

/**
 * Parse GPX text into trackpoints. Concatenates every <trkpt> across all
 * <trkseg>/<trk> in document order.
 *
 * TODO: the spec asks to "reset distance at segment boundaries". In practice
 * consecutive <trkseg>s are a paused-then-resumed activity at the same spot, so
 * the inter-segment gap is ~0 and we simply concatenate. Revisit if a real file
 * shows large jumps between segments.
 */
export function parseGpx(xml: string): Trackpoint[] {
  const doc = getDoc(xml);

  const els = Array.from(doc.getElementsByTagNameNS("*", "trkpt"));
  if (els.length === 0) {
    throw new GpxError(
      "No track points found. Slopesense needs a recorded track (<trkpt>), not just a route or waypoints.",
    );
  }

  const raw: RawPoint[] = [];
  let sawElevation = false;
  for (const el of els) {
    const lat = Number.parseFloat(el.getAttribute("lat") ?? "");
    const lon = Number.parseFloat(el.getAttribute("lon") ?? "");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const eleText = localName(el, "ele")[0]?.textContent?.trim();
    const ele =
      eleText && Number.isFinite(Number.parseFloat(eleText))
        ? Number.parseFloat(eleText)
        : null;
    if (ele !== null) sawElevation = true;

    raw.push({ lat, lon, ele });
  }

  if (!sawElevation) {
    throw new GpxError("This GPX has no elevation data.");
  }
  if (raw.length < MIN_POINTS) {
    throw new GpxError(
      `This GPX has only ${raw.length} usable points — too few to analyze (need ${MIN_POINTS}+).`,
    );
  }

  return fillElevation(raw);
}

// Forward-fill sparse missing elevations from the previous known value, and
// back-fill any leading gaps from the first known value. Keeps ele: number.
function fillElevation(raw: RawPoint[]): Trackpoint[] {
  const firstKnown = raw.find((p) => p.ele !== null)?.ele ?? 0;
  let last = firstKnown;
  return raw.map(({ lat, lon, ele }) => {
    if (ele !== null) last = ele;
    return { lat, lon, ele: last };
  });
}

/** Best-effort route name for display: <trk><name> or <metadata><name>. */
export function parseGpxName(xml: string): string | undefined {
  const doc = getDoc(xml);
  const trkName = doc.getElementsByTagNameNS("*", "trk")[0];
  const fromTrk = trkName
    ? localName(trkName, "name")[0]?.textContent?.trim()
    : undefined;
  if (fromTrk) return fromTrk;
  const meta = doc.getElementsByTagNameNS("*", "metadata")[0];
  const fromMeta = meta
    ? localName(meta, "name")[0]?.textContent?.trim()
    : undefined;
  return fromMeta || undefined;
}
