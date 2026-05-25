import { classificationLabel, strategyHint } from "@/lib/classify";
import type { Section } from "@/lib/types";

import { fmtGrade, fmtKm, fmtKmRange, fmtMeters } from "./format";
import { badgeStyle, runabilityColor } from "./runability";

const TYPE_LABEL: Record<Section["type"], string> = {
  climb: "Climb",
  descent: "Descent",
  flat: "Flat / rolling",
};

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {label}
      </span>
      <span className="text-base font-semibold tabular-nums text-stone-900 dark:text-stone-100">
        {value}
      </span>
    </div>
  );
}

export default function SectionDetail({
  section,
  onClose,
}: {
  section: Section;
  onClose: () => void;
}) {
  const color = runabilityColor(section.classification);
  const dropLabel = section.type === "climb" ? "Gain" : "Drop";

  return (
    <div
      className="rounded-xl border border-l-4 border-stone-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {TYPE_LABEL[section.type]} · {fmtKmRange(section.kmStart, section.kmEnd)}
          </h3>
          <span
            className="rounded-full border px-2 py-0.5 text-xs font-medium"
            style={badgeStyle(section.classification)}
          >
            {classificationLabel(section.classification)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close section detail"
          className="-mr-1 shrink-0 rounded-md px-2 py-1 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
        >
          Close
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <DetailStat label="Distance" value={fmtKm(section.distanceKm)} />
        <DetailStat label={dropLabel} value={fmtMeters(section.drop)} />
        <DetailStat label="Avg grade" value={fmtGrade(section.avgGrade)} />
        <DetailStat label="Max grade" value={fmtGrade(section.maxGrade)} />
      </div>

      <p className="mt-4 border-t border-stone-100 pt-3 text-sm text-stone-700 dark:border-stone-800 dark:text-stone-300">
        <span className="font-medium text-stone-900 dark:text-stone-100">Strategy: </span>
        {strategyHint(section.type, section.classification)}
      </p>
    </div>
  );
}
