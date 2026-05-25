"use client";

import { useRef } from "react";

interface Props {
  onFiles: (files: FileList | File[]) => void;
  onLoadSample: () => void;
}

export default function GpxUpload({ onFiles, onLoadSample }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="w-full rounded-2xl border-2 border-dashed border-stone-300 bg-white p-8 text-center sm:p-12 dark:border-stone-700 dark:bg-stone-900">
      <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100">
        Analyze a GPX route
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-stone-600 dark:text-stone-400">
        Drop a <code className="font-mono">.gpx</code> file anywhere on this page, or
        pick one below. Slopesense finds the climbs and descents and tells you where
        you&apos;ll run and where the quads get destroyed.
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-11 items-center justify-center rounded-lg bg-[#185FA5] px-5 text-sm font-medium text-white transition-colors hover:bg-[#13507f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#185FA5]"
        >
          Choose a .gpx file
        </button>
        <button
          type="button"
          onClick={onLoadSample}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-stone-300 px-5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-100 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800"
        >
          Try a sample route
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx,application/gpx+xml"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      <p className="mt-6 text-xs text-stone-500 dark:text-stone-500">
        All processing happens in your browser. Nothing is uploaded.
      </p>
    </div>
  );
}
