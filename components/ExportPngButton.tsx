"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { downloadCanvasAsPng, renderPoster } from "@/lib/exportPng";
import { downloadCollectionPng, renderCollectionPoster } from "@/lib/exportCollectionPng";

/**
 * Tombol Export PNG di NAVBAR /editor — render kualitas cetak (dpi penuh)
 * sesuai mode aktif (single / koleksi). Menggantikan tombol yang dulu ada di
 * header kartu preview.
 */
export default function ExportPngButton() {
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
      const pxPerMm = posterSize.dpi / 25.4;
      if (posterMode === "single") {
        if (!gpxData) return;
        const canvas = await renderPoster({ posterSize, gpxData, markers, stats, theme, registrationMarks, pxPerMm });
        const filename = `poster-${(stats.mountainName || "gpx-summit").replace(/\s+/g, "-").toLowerCase()}.png`;
        downloadCanvasAsPng(canvas, filename);
      } else {
        const canvas = await renderCollectionPoster({ posterSize, collection, pxPerMm, theme });
        const filename = `poster-koleksi-${(collection.expeditionTitle || "ekspedisi").replace(/\s+/g, "-").toLowerCase()}.png`;
        downloadCollectionPng(canvas, filename);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal export PNG.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      title="Export PNG kualitas cetak"
      className="clay-btn flex items-center gap-1.5 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-3 py-2 text-xs font-medium text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60 sm:px-3.5 sm:text-sm"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      <span className="hidden sm:inline">Export PNG</span>
    </button>
  );
}
