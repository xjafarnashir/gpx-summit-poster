"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { parseGpxFile } from "@/lib/gpxParser";
import { useAppStore } from "@/lib/store";

export default function GpxUpload() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const gpxFileName = useAppStore((s) => s.gpxFileName);
  const gpxData = useAppStore((s) => s.gpxData);
  const setGpxData = useAppStore((s) => s.setGpxData);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const result = await parseGpxFile(file);
        setGpxData(file.name, result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memproses file GPX.");
      } finally {
        setLoading(false);
      }
    },
    [setGpxData]
  );

  return (
    <div className="clay-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
          <UploadCloud size={15} />
        </span>
        2. Upload GPX
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        File hasil rekaman pendakian (.gpx). Hanya titik rute (&lt;trkpt&gt;) yang dipakai — POI/&lt;wpt&gt; diabaikan.
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver
            ? "border-[#d97757] bg-[#f7e9e1] dark:bg-[#3a2a22]"
            : "border-zinc-300 hover:border-[#d97757] hover:bg-[#f7e9e1]/60 dark:border-zinc-700 dark:hover:border-[#a8552f] dark:hover:bg-[#3a2a22]/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
        <UploadCloud
          size={22}
          className={dragOver ? "text-[#d97757]" : "text-zinc-400 dark:text-zinc-500"}
        />
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {loading ? "Memproses..." : "Klik atau drag & drop file .gpx di sini"}
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {gpxData && !error && (
        <div className="clay-well mt-4 grid grid-cols-2 gap-3 p-3 text-sm sm:grid-cols-4">
          <Stat label="File" value={gpxFileName ?? "-"} />
          <Stat label="Titik" value={gpxData.points.length.toString()} />
          <Stat label="Jarak" value={`${gpxData.distanceKm.toFixed(2)} km`} />
          <Stat label="Elevation Gain" value={`${Math.round(gpxData.elevationGainM)} m`} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{value}</div>
    </div>
  );
}
