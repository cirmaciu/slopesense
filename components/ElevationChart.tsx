"use client";

import {
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
  type ScriptableLineSegmentContext,
} from "chart.js";
import { useSyncExternalStore } from "react";
import { Line } from "react-chartjs-2";

import type { RouteAnalysis, Section } from "@/lib/types";

import { fmtGrade } from "./format";
import { ACCENT, runabilityColor } from "./runability";

// react-chartjs-2 auto-registers the line controller; we register the scales,
// elements and plugins we actually use (keeps the bundle lean).
ChartJS.register(LinearScale, PointElement, LineElement, Filler, Tooltip);

const DARK_QUERY = "(prefers-color-scheme: dark)";

// Subscribe to the OS dark-mode preference without setState-in-effect.
function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(DARK_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DARK_QUERY).matches,
    () => false, // server snapshot
  );
}

function sectionAtKm(sections: readonly Section[], km: number): Section | undefined {
  return sections.find((s) => km >= s.kmStart && km <= s.kmEnd);
}

export default function ElevationChart({
  analysis,
  selected,
}: {
  analysis: RouteAnalysis;
  selected: Section | null;
}) {
  const dark = usePrefersDark();
  const { profile, sections } = analysis;

  const eles = profile.map((p) => p.ele);
  const minE = Math.min(...eles);
  const maxE = Math.max(...eles);
  const pad = Math.max(30, Math.round((maxE - minE) * 0.15));

  const grid = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)";
  const tick = dark ? "#a8a29e" : "#57534e";

  // Midpoint km of the segment leaving profile point `i`.
  const segMidKm = (ctx: ScriptableLineSegmentContext): number => {
    const a = profile[ctx.p0DataIndex]?.km ?? 0;
    const b = profile[ctx.p1DataIndex]?.km ?? a;
    return (a + b) / 2;
  };

  const data: ChartData<"line"> = {
    datasets: [
      {
        label: "Elevation",
        data: profile.map((p) => ({ x: p.km, y: p.ele })),
        parsing: false,
        borderColor: ACCENT,
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        tension: 0.15,
        fill: true,
        backgroundColor: dark ? "rgba(24,95,165,0.14)" : "rgba(24,95,165,0.08)",
        // Color descent segments by runability; keep climbs/flats on the accent.
        segment: {
          borderColor: (ctx) => {
            const sec = sectionAtKm(sections, segMidKm(ctx));
            return sec?.type === "descent"
              ? runabilityColor(sec.classification)
              : ACCENT;
          },
          // Thicken whichever section is currently selected.
          borderWidth: (ctx) => {
            if (!selected) return 2;
            const km = segMidKm(ctx);
            return km >= selected.kmStart && km <= selected.kmEnd ? 5 : 2;
          },
        },
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        type: "linear",
        title: { display: true, text: "Distance (km)", color: tick },
        grid: { color: grid },
        ticks: { color: tick, maxTicksLimit: 8 },
      },
      y: {
        type: "linear",
        suggestedMin: minE - pad,
        suggestedMax: maxE + pad,
        title: { display: true, text: "Elevation (m)", color: tick },
        grid: { color: grid },
        ticks: { color: tick },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const p = profile[items[0]?.dataIndex ?? 0];
            return p ? `km ${p.km.toFixed(1)}` : "";
          },
          label: (item) => {
            const p = profile[item.dataIndex];
            if (!p) return "";
            return [`Elevation: ${Math.round(p.ele)} m`, `Grade: ${fmtGrade(p.grade)}`];
          },
        },
      },
    },
  };

  return (
    <div className="h-[280px] w-full md:h-[360px]">
      <Line data={data} options={options} />
    </div>
  );
}
