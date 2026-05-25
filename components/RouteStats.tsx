import { countSignificant } from "@/lib/analyzer";
import type { RouteAnalysis } from "@/lib/types";

import { fmtKm, fmtMeters } from "./format";

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
        {label}
      </dt>
      <dd className="text-lg font-semibold tabular-nums text-stone-900 dark:text-stone-100">
        {value}
      </dd>
      {sub ? (
        <dd className="text-xs tabular-nums text-stone-500 dark:text-stone-400">{sub}</dd>
      ) : null}
    </div>
  );
}

export default function RouteStats({ analysis }: { analysis: RouteAnalysis }) {
  const { climbs, descents } = countSignificant(analysis.sections);
  return (
    <dl className="grid grid-cols-2 gap-4 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-6 dark:border-stone-800 dark:bg-stone-900">
      <Stat label="Distance" value={fmtKm(analysis.totalDistanceKm)} />
      <Stat label="Ascent D+" value={fmtMeters(analysis.totalAscent)} />
      <Stat label="Descent D−" value={fmtMeters(analysis.totalDescent)} />
      <Stat
        label="Highest"
        value={fmtMeters(analysis.highestPoint.ele)}
        sub={`@ ${fmtKm(analysis.highestPoint.km)}`}
      />
      <Stat
        label="Lowest"
        value={fmtMeters(analysis.lowestPoint.ele)}
        sub={`@ ${fmtKm(analysis.lowestPoint.km)}`}
      />
      <Stat
        label="Climbs / Descents"
        value={`${climbs} / ${descents}`}
        sub="drop ≥ 100 m"
      />
    </dl>
  );
}
