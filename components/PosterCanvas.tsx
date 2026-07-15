"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { renderPoster } from "@/lib/exportPng";

const PREVIEW_TARGET_WIDTH_PX = 1040;

export default function PosterCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
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

  if (!gpxData) return null;

  // Tanpa header & tanpa scroll: canvas dipaskan ke tinggi viewport (navbar +
  // padding ± 165px) supaya poster selalu utuh terlihat di kolom kiri.
  return (
    <div className="clay-card p-4">
      <div className="clay-well relative flex justify-center overflow-hidden p-3">
        {rendering && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/10">
            <Loader2 size={24} className="animate-spin text-zinc-500" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="max-h-[75vh] w-auto max-w-full rounded-md shadow-md lg:max-h-[calc(100vh-165px)]"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
