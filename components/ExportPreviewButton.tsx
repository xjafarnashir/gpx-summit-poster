"use client";

import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { downloadCanvasAsPng, renderPoster } from "@/lib/exportPng";
import { downloadCollectionPng, renderCollectionPoster } from "@/lib/exportCollectionPng";
import { PREVIEW_DPI, applyPreviewWatermark } from "@/lib/exportPreview";

/**
 * Tombol "Preview" di NAVBAR /editor: export PNG BER-WATERMARK
 * ("myKoordinat · PREVIEW", diagonal, memenuhi poster) pada resolusi layar
 * (150 dpi) — aman dikirim ke customer sebelum bayar. Versi bersih kualitas
 * cetak tetap lewat Export PNG / Export Full.
 */
export default function ExportPreviewButton() {
  const [busy, setBusy] = useState(false);

  const posterMode = useAppStore((s) => s.posterMode);
  const posterSize = useAppStore((s) => s.posterSize);
  const gpxData = useAppStore((s) => s.gpxData);
  const markers = useAppStore((s) => s.markers);
  const stats = useAppStore((s) => s.stats);
  const theme = useAppStore((s) => s.theme);
  const collection = useAppStore((s) => s.collection);
  const registrationMarks = useAppStore((s) => s.export3d.registrationMarks);

  const disabled = busy || (posterMode === "single" && !gpxData);

  const handleExport = async () => {
    setBusy(true);
    try {
      const pxPerMm = PREVIEW_DPI / 25.4;
      if (posterMode === "single") {
        if (!gpxData) return;
        const canvas = await renderPoster({ posterSize, gpxData, markers, stats, theme, registrationMarks, pxPerMm });
        applyPreviewWatermark(canvas);
        const filename = `preview-${(stats.mountainName || "gpx-summit").replace(/\s+/g, "-").toLowerCase()}.png`;
        downloadCanvasAsPng(canvas, filename);
      } else {
        const canvas = await renderCollectionPoster({ posterSize, collection, pxPerMm, theme });
        applyPreviewWatermark(canvas);
        const filename = `preview-koleksi-${(collection.expeditionTitle || "ekspedisi").replace(/\s+/g, "-").toLowerCase()}.png`;
        downloadCollectionPng(canvas, filename);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal export preview.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      title="Export Preview — PNG ber-watermark untuk dikirim ke customer sebelum bayar"
      className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-600 transition-colors hover:text-[#9c4a2c] disabled:opacity-50 dark:text-zinc-300 dark:hover:text-[#e59a7c] sm:px-3.5 sm:text-sm"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
      <span className="hidden sm:inline">Preview</span>
    </button>
  );
}
