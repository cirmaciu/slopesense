"use client";

import { useMemo, useState } from "react";

import { classificationLabel } from "@/lib/classify";
import type { Section } from "@/lib/types";

import { fmtGrade, fmtKm, fmtKmRange, fmtMeters } from "./format";
import { badgeStyle, runabilityColor } from "./runability";

type Tab = "descent" | "climb";
type SortKey = "km" | "drop" | "grade";
type SortDir = "asc" | "desc";

const DEFAULT_MIN_DROP = 150;

const SORT_VALUE: Record<SortKey, (s: Section) => number> = {
  km: (s) => s.kmStart,
  drop: (s) => s.drop,
  grade: (s) => Math.abs(s.avgGrade),
};

export default function SectionTable({
  sections,
  selected,
  onSelect,
}: {
  sections: Section[];
  selected: Section | null;
  onSelect: (section: Section | null) => void;
}) {
  const [tab, setTab] = useState<Tab>("descent");
  const [sortKey, setSortKey] = useState<SortKey>("km");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [minDrop, setMinDrop] = useState(DEFAULT_MIN_DROP);

  const maxDrop = useMemo(() => {
    const m = sections.reduce((acc, s) => Math.max(acc, s.drop), 0);
    return Math.max(50, Math.ceil(m / 50) * 50);
  }, [sections]);

  const rows = useMemo(() => {
    const filtered = sections.filter(
      (s) => s.type === tab && s.drop >= minDrop,
    );
    const sign = sortDir === "asc" ? 1 : -1;
    const value = SORT_VALUE[sortKey];
    return [...filtered].sort((a, b) => sign * (value(a) - value(b)));
  }, [sections, tab, minDrop, sortKey, sortDir]);

  const dropHeader = tab === "climb" ? "Gain" : "Drop";

  function switchTab(next: Tab) {
    if (next === tab) return;
    setTab(next);
    onSelect(null);
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "km" ? "asc" : "desc");
    }
  }

  const ariaSort = (key: SortKey): "ascending" | "descending" | "none" =>
    sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";

  const sortArrow = (key: SortKey): string =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <section className="rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <div className="flex flex-col gap-4 border-b border-stone-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800">
        <div className="inline-flex rounded-lg bg-stone-100 p-1 dark:bg-stone-800">
          <TabButton active={tab === "descent"} onClick={() => switchTab("descent")}>
            Descents
          </TabButton>
          <TabButton active={tab === "climb"} onClick={() => switchTab("climb")}>
            Climbs
          </TabButton>
        </div>

        <label className="flex items-center gap-3 text-sm text-stone-600 dark:text-stone-400">
          <span className="whitespace-nowrap">
            Min {dropHeader.toLowerCase()}:{" "}
            <span className="font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              {minDrop} m
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={maxDrop}
            step={10}
            value={minDrop}
            onChange={(e) => setMinDrop(Number(e.target.value))}
            className="w-40 accent-[#185FA5]"
            aria-label={`Minimum ${dropHeader.toLowerCase()} in meters`}
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-500 dark:border-stone-800 dark:text-stone-400">
              <SortableTh
                label={`Range${sortArrow("km")}`}
                ariaSort={ariaSort("km")}
                onClick={() => toggleSort("km")}
              />
              <th className="px-4 py-2 font-medium">Dist</th>
              <SortableTh
                label={`${dropHeader}${sortArrow("drop")}`}
                ariaSort={ariaSort("drop")}
                onClick={() => toggleSort("drop")}
              />
              <SortableTh
                label={`Avg${sortArrow("grade")}`}
                ariaSort={ariaSort("grade")}
                onClick={() => toggleSort("grade")}
              />
              <th className="px-4 py-2 font-medium">Max</th>
              <th className="px-4 py-2 font-medium">Class</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const isSelected = selected === s;
              return (
                <tr
                  key={`${s.type}-${s.kmStart}-${s.kmEnd}`}
                  onClick={() => onSelect(isSelected ? null : s)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(isSelected ? null : s);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={`cursor-pointer border-b border-stone-50 tabular-nums transition-colors last:border-0 focus:outline-none focus-visible:bg-stone-100 dark:border-stone-800/60 dark:focus-visible:bg-stone-800 ${
                    isSelected
                      ? "bg-stone-100 dark:bg-stone-800"
                      : "hover:bg-stone-50 dark:hover:bg-stone-800/50"
                  }`}
                  style={
                    isSelected
                      ? { boxShadow: `inset 3px 0 0 0 ${runabilityColor(s.classification)}` }
                      : undefined
                  }
                >
                  <td className="px-4 py-2.5 font-medium text-stone-900 dark:text-stone-100">
                    {fmtKmRange(s.kmStart, s.kmEnd)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-700 dark:text-stone-300">
                    {fmtKm(s.distanceKm)}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-stone-900 dark:text-stone-100">
                    {fmtMeters(s.drop)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-700 dark:text-stone-300">
                    {fmtGrade(s.avgGrade)}
                  </td>
                  <td className="px-4 py-2.5 text-stone-700 dark:text-stone-300">
                    {fmtGrade(s.maxGrade)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className="rounded-full border px-2 py-0.5 text-xs font-medium"
                      style={badgeStyle(s.classification)}
                    >
                      {classificationLabel(s.classification)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-stone-500 dark:text-stone-400">
            No {tab === "climb" ? "climbs" : "descents"} with {dropHeader.toLowerCase()} ≥{" "}
            {minDrop} m. Lower the filter to see smaller sections.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-white text-stone-900 shadow-sm dark:bg-stone-950 dark:text-stone-100"
          : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
      }`}
    >
      {children}
    </button>
  );
}

function SortableTh({
  label,
  ariaSort,
  onClick,
}: {
  label: string;
  ariaSort: "ascending" | "descending" | "none";
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-2 font-medium" aria-sort={ariaSort}>
      <button
        type="button"
        onClick={onClick}
        className="-mx-1 rounded px-1 uppercase tracking-wide hover:text-stone-900 dark:hover:text-stone-200"
      >
        {label}
      </button>
    </th>
  );
}
