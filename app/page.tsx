"use client";

import { useCallback, useEffect, useState } from "react";

import ElevationChart from "@/components/ElevationChart";
import GpxUpload from "@/components/GpxUpload";
import RouteStats from "@/components/RouteStats";
import SectionDetail from "@/components/SectionDetail";
import SectionTable from "@/components/SectionTable";
import { fmtKm, fmtMeters } from "@/components/format";
import { analyze } from "@/lib/analyzer";
import { GpxError, parseGpx, parseGpxName } from "@/lib/gpx";
import type { RouteAnalysis, Section } from "@/lib/types";

type Status = "empty" | "analyzing" | "result" | "error";

const MAX_COMFORTABLE_BYTES = 5 * 1024 * 1024;

export default function Home() {
  const [status, setStatus] = useState<Status>("empty");
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [routeName, setRouteName] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Section | null>(null);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const runAnalysis = useCallback(async (text: string, fallbackName: string) => {
    setStatus("analyzing");
    setError("");
    setSelected(null);
    // Let the spinner paint before the synchronous crunch (instant for normal
    // files, but keeps the UI honest for large ones).
    // TODO: move analyze() into a Web Worker when trackpoints > 20k.
    await new Promise((resolve) => setTimeout(resolve, 30));
    try {
      const points = parseGpx(text);
      const result = analyze(points);
      setAnalysis(result);
      setRouteName(parseGpxName(text) || fallbackName);
      setStatus("result");
    } catch (e) {
      setError(
        e instanceof GpxError || e instanceof Error
          ? e.message
          : "Could not read this GPX file.",
      );
      setStatus("error");
    }
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const file = Array.from(files)[0];
      if (!file) return;
      if (!/\.gpx$/i.test(file.name)) {
        setNotice("Please choose a .gpx file.");
        return;
      }
      if (file.size > MAX_COMFORTABLE_BYTES) {
        setNotice("Heads up: this file is over 5 MB — analysis may be slow.");
      }
      const text = await file.text();
      void runAnalysis(text, file.name.replace(/\.gpx$/i, ""));
    },
    [runAnalysis],
  );

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch("/sample.gpx");
      if (!res.ok) throw new Error("fetch failed");
      void runAnalysis(await res.text(), "Sample route");
    } catch {
      setNotice("Couldn't load the sample route.");
    }
  }, [runAnalysis]);

  const reset = useCallback(() => {
    setStatus("empty");
    setAnalysis(null);
    setRouteName("");
    setError("");
    setSelected(null);
  }, []);

  // Full-window drag & drop so a file dropped anywhere gets analyzed.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
      setDragging(true);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer?.files.length) void handleFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  return (
    <div className="flex min-h-full flex-col bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      {dragging ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/40 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-[#185FA5] bg-white/90 px-10 py-8 text-lg font-medium text-[#185FA5] dark:bg-stone-900/90">
            Drop your .gpx to analyze
          </div>
        </div>
      ) : null}

      <header className="sticky top-0 z-20 border-b border-stone-200 bg-stone-50/85 backdrop-blur dark:border-stone-800 dark:bg-stone-950/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <button
            type="button"
            onClick={reset}
            className="flex items-baseline gap-2 text-left"
            aria-label="Slopesense home"
          >
            <span className="text-lg font-bold text-[#185FA5]">Slopesense</span>
            <span className="hidden text-xs text-stone-500 sm:inline dark:text-stone-400">
              GPX trail analyzer
            </span>
          </button>

          {status === "result" && analysis ? (
            <div className="flex min-w-0 items-center gap-4">
              <span className="hidden min-w-0 truncate text-sm font-medium text-stone-700 md:inline dark:text-stone-300">
                {routeName}
              </span>
              <div className="hidden gap-4 text-sm tabular-nums sm:flex">
                <HeaderStat label="Dist" value={fmtKm(analysis.totalDistanceKm)} />
                <HeaderStat label="D+" value={fmtMeters(analysis.totalAscent)} />
                <HeaderStat label="D−" value={fmtMeters(analysis.totalDescent)} />
              </div>
              <button
                type="button"
                onClick={reset}
                className="shrink-0 rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
              >
                New
              </button>
            </div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
        {(status === "empty" || status === "error") && (
          <div className="mx-auto flex max-w-2xl flex-col gap-5 py-8">
            {status === "error" ? (
              <div className="rounded-xl border border-[#993556]/40 bg-[#993556]/10 p-4 text-sm text-[#993556] dark:text-[#d98aa3]">
                <span className="font-semibold">Couldn&apos;t analyze that file. </span>
                {error}
              </div>
            ) : null}
            <GpxUpload onFiles={handleFiles} onLoadSample={loadSample} />
          </div>
        )}

        {status === "analyzing" && (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-stone-500 dark:text-stone-400">
            <span className="size-8 animate-spin rounded-full border-2 border-stone-300 border-t-[#185FA5] dark:border-stone-700 dark:border-t-[#185FA5]" />
            <p className="text-sm">Parsing GPX…</p>
          </div>
        )}

        {status === "result" && analysis ? (
          <div className="flex flex-col gap-6">
            <h1 className="text-2xl font-bold text-stone-900 md:hidden dark:text-stone-100">
              {routeName}
            </h1>

            {analysis.warnings.map((w) => (
              <div
                key={w}
                className="rounded-xl border border-[#BA7517]/40 bg-[#BA7517]/10 p-3 text-sm text-[#8a560f] dark:text-[#e0a85a]"
              >
                {w}
              </div>
            ))}

            <RouteStats analysis={analysis} />

            <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 dark:border-stone-800 dark:bg-stone-900">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                  Elevation profile
                </h2>
                <Legend />
              </div>
              <ElevationChart analysis={analysis} selected={selected} />
            </section>

            <SectionTable
              sections={analysis.sections}
              selected={selected}
              onSelect={setSelected}
            />

            {selected ? (
              <SectionDetail section={selected} onClose={() => setSelected(null)} />
            ) : null}
          </div>
        ) : null}
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-xs text-stone-500 dark:border-stone-800 dark:text-stone-500">
        Slopesense — all analysis runs in your browser. Nothing is uploaded.
      </footer>

      {notice ? (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        >
          {notice}
        </div>
      ) : null}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-xs text-stone-500 dark:text-stone-400">{label}</span>
      <span className="font-semibold text-stone-900 dark:text-stone-100">{value}</span>
    </span>
  );
}

function Legend() {
  const items: { color: string; label: string }[] = [
    { color: "#4A8862", label: "Runnable" },
    { color: "#BA7517", label: "Mixed" },
    { color: "#993556", label: "Hike" },
  ];
  return (
    <ul className="flex items-center gap-3 text-xs text-stone-500 dark:text-stone-400">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-3 rounded-full"
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
