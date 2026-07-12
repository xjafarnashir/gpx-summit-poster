"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { downloadCanvasAsPng, renderPoster } from "@/lib/exportPng";
import { projectRoute } from "@/lib/projection";

const PREVIEW_TARGET_WIDTH_PX = 1040;

export default function PosterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const posterSize = useAppStore((s) => s.posterSize);
  const gpxData = useAppStore((s) => s.gpxData);
  const markers = useAppStore((s) => s.markers);
  const stats = useAppStore((s) => s.stats);
  const theme = useAppStore((s) => s.theme);
  const registrationMarks = useAppStore((s) => s.export3d.registrationMarks);

  const depsKey = JSON.stringify({ posterSize, markers, stats, theme, registrationMarks, gpxFileName: gpxData ? gpxData.points.length : 0 });

  useEffect(() => {
    if (!gpxData) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setRendering(true);
      setError(null);
      const pxPerMm = PREVIEW_TARGET_WIDTH_PX / posterSize.widthMm;
      renderPoster({
        posterSize,
        gpxData,
        markers,
        stats,
        theme,
        registrationMarks,
        pxPerMm,
      })
        .then((canvas) => {
          if (cancelled) return;
          const target = canvasRef.current;
          if (!target) return;
          target.width = canvas.width;
          target.height = canvas.height;
          const ctx = target.getContext("2d");
          ctx?.drawImage(canvas, 0, 0);
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Gagal render poster.");
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, gpxData]);

  const handleExportPng = async () => {
    if (!gpxData) return;
    setExporting(true);
    setError(null);
    try {
      const pxPerMm = posterSize.dpi / 25.4;
      const canvas = await renderPoster({
        posterSize,
        gpxData,
        markers,
        stats,
        theme,
        registrationMarks,
        pxPerMm,
      });

      // Sanity check: printed route bbox (mm) should sit within the map area (mm).
      const proj = projectRoute(posterSize, gpxData.points);
      // eslint-disable-next-line no-console
      console.log("[1:1 check] Map area (mm):", posterSize.mapAreaMm.width.toFixed(2), "x", posterSize.mapAreaMm.height.toFixed(2));
      // eslint-disable-next-line no-console
      console.log("[1:1 check] Route bbox within map area (mm):", proj.bboxMm.width.toFixed(2), "x", proj.bboxMm.height.toFixed(2));

      const filename = `poster-${(stats.mountainName || "gpx-summit").replace(/\s+/g, "-").toLowerCase()}.png`;
      downloadCanvasAsPng(canvas, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal export PNG.");
    } finally {
      setExporting(false);
    }
  };

  if (!gpxData) return null;

  return (
    <div className="clay-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
            <ImageIcon size={15} />
          </span>
          Preview Poster
        </h2>
        <button
          type="button"
          onClick={handleExportPng}
          disabled={exporting}
          className="clay-btn flex items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export PNG
        </button>
      </div>

      <div className="clay-well relative flex justify-center overflow-hidden p-3">
        {rendering && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10">
            <Loader2 size={24} className="animate-spin text-zinc-500" />
          </div>
        )}
        <canvas ref={canvasRef} className="max-w-full rounded-md shadow-md" />
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
