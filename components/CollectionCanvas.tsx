"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ImageIcon, Loader2, TriangleAlert } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { downloadCollectionPng, renderCollectionPoster } from "@/lib/exportCollectionPng";
import { isLandscapeSize } from "@/lib/projection";

const PREVIEW_TARGET_WIDTH_PX = 1280;

export default function CollectionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const posterSize = useAppStore((s) => s.posterSize);
  const collection = useAppStore((s) => s.collection);

  // Compact dependency signature — avoid stringifying full GPX point arrays.
  const depsKey = JSON.stringify({
    posterSize,
    exp: {
      t: collection.expeditionTitle,
      d: collection.expeditionDesc,
      c: collection.climberName,
      ig: collection.instagram,
      tt: collection.tiktok,
      qr: collection.qrCodeUrl,
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
      renderCollectionPoster({ posterSize, collection, pxPerMm })
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

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const pxPerMm = posterSize.dpi / 25.4;
      const canvas = await renderCollectionPoster({ posterSize, collection, pxPerMm });
      const filename = `poster-koleksi-${(collection.expeditionTitle || "ekspedisi").replace(/\s+/g, "-").toLowerCase()}.png`;
      downloadCollectionPng(canvas, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal export PNG.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="clay-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
            <ImageIcon size={15} />
          </span>
          Preview Poster Koleksi
        </h2>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="clay-btn flex items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-4 py-2 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          Export PNG
        </button>
      </div>

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
        <canvas ref={canvasRef} className="max-w-full rounded-md shadow-md" />
      </div>

      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
