"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { renderCollectionPoster } from "@/lib/exportCollectionPng";
import { isLandscapeSize } from "@/lib/projection";

const PREVIEW_TARGET_WIDTH_PX = 1280;

export default function CollectionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const posterSize = useAppStore((s) => s.posterSize);
  const collection = useAppStore((s) => s.collection);
  const theme = useAppStore((s) => s.theme);

  // Compact dependency signature — avoid stringifying full GPX point arrays.
  const depsKey = JSON.stringify({
    posterSize,
    theme: { gradientBrightness: theme.gradientBrightness },
    exp: {
      t: collection.expeditionTitle,
      d: collection.expeditionDesc,
      c: collection.climberName,
      ig: collection.instagram,
      tt: collection.tiktok,
      qr: collection.qrCodeUrl,
      bg: collection.backgroundTheme,
    },
    hikes: collection.hikes.map((h) => ({
      id: h.id,
      n: h.mountainName,
      v: h.viaRoute,
      dt: h.date,
      e: h.summitElevationM,
      km: h.distanceKm,
      g: h.elevationGainM,
      mt: h.movingTime,
      du: h.duration,
      col: h.routeColor,
      rot: h.mapRotationDeg,
      pts: h.gpxData ? h.gpxData.points.length : 0,
      gpx: h.gpxFileName,
      ph: h.climberPhoto ? h.climberPhoto.length : 0,
      tf: h.climberPhotoTransform,
    })),
  });

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setRendering(true);
      setError(null);
      const pxPerMm = PREVIEW_TARGET_WIDTH_PX / posterSize.widthMm;
      renderCollectionPoster({ posterSize, collection, pxPerMm, theme })
        .then((canvas) => {
          if (cancelled) return;
          const target = canvasRef.current;
          if (!target) return;
          target.width = canvas.width;
          target.height = canvas.height;
          target.getContext("2d")?.drawImage(canvas, 0, 0);
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
  }, [depsKey]);

  // Tanpa header & tanpa scroll: canvas dipaskan ke tinggi viewport (navbar +
  // padding ± 165px) supaya poster selalu utuh terlihat di kolom kiri.
  return (
    <div className="clay-card p-4">
      {!isLandscapeSize(posterSize) && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
          <TriangleAlert size={14} className="mt-0.5 shrink-0" />
          <p>Poster koleksi paling pas dengan orientasi <strong>landscape</strong>. Ubah orientasi di setup ukuran.</p>
        </div>
      )}

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
