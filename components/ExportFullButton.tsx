"use client";

import { useState } from "react";
import { FolderDown, Loader2 } from "lucide-react";
import JSZip from "jszip";
import { useAppStore } from "@/lib/store";
import { renderPoster } from "@/lib/exportPng";
import { collectionBlockSize, renderCollectionPoster } from "@/lib/exportCollectionPng";
import { exportRouteStl } from "@/lib/exportStl";
import { renderResiCanvas } from "@/lib/exportResiPng";
import type { CollectionHike, RouteMarker } from "@/types";

/**
 * Tombol "Export Full" di NAVBAR /editor: satu klik → satu file ZIP berisi
 * SEMUA hasil produksi:
 *   - poster PNG kualitas cetak (dpi penuh)
 *   - STL jalur 3D 1:1 (satu file per gunung di mode koleksi)
 *   - resi pengiriman PNG 10x15 cm (bila pesanan sudah diimpor)
 * Memakai setelan Export 3D yang sama dengan panelnya (lebar garis, tinggi
 * extrude, dst), jadi hasilnya identik dengan export satu-satu.
 *
 * SVG sengaja TIDAK dibundel: pembuatannya lewat boolean union polyclip yang
 * O(n^2) — ~11 dtk untuk jalur rapat hasil generator (1200+ titik), sementara
 * sisa bundel cuma ~2 dtk. SVG tetap tersedia lewat tombol "Export SVG" di
 * panel Export 3D bila sewaktu-waktu dibutuhkan.
 */
export default function ExportFullButton() {
  const [busy, setBusy] = useState(false);

  const posterMode = useAppStore((s) => s.posterMode);
  const posterSize = useAppStore((s) => s.posterSize);
  const gpxData = useAppStore((s) => s.gpxData);
  const markers = useAppStore((s) => s.markers);
  const stats = useAppStore((s) => s.stats);
  const theme = useAppStore((s) => s.theme);
  const collection = useAppStore((s) => s.collection);
  const export3d = useAppStore((s) => s.export3d);
  const shipping = useAppStore((s) => s.shipping);

  const hikesWithGpx = collection.hikes.filter((h) => h.gpxData && h.gpxData.points.length >= 2);
  const disabled = busy || (posterMode === "single" ? !gpxData : hikesWithGpx.length === 0);

  const slug = (s: string, fb: string) => (s.trim() || fb).replace(/\s+/g, "-").toLowerCase();

  const canvasToPngBlob = (canvas: HTMLCanvasElement): Promise<Blob> =>
    new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat PNG."))), "image/png")
    );

  // Marker sintetis per gunung koleksi — sama dengan Collection3DPanel.
  const syntheticMarkers = (hike: CollectionHike): RouteMarker[] => {
    const n = hike.gpxData!.points.length;
    return [
      { id: `${hike.id}-bc`, type: "basecamp", label: "Basecamp", trackIndex: 0 },
      { id: `${hike.id}-sm`, type: "summit", label: "Puncak", trackIndex: n - 1 },
    ];
  };

  const handleExport = async () => {
    setBusy(true);
    try {
      const zip = new JSZip();
      const pxPerMm = posterSize.dpi / 25.4;
      let zipName: string;

      if (posterMode === "single") {
        if (!gpxData) return;
        const base = slug(stats.mountainName, "gpx-summit");
        const canvas = await renderPoster({
          posterSize,
          gpxData,
          markers,
          stats,
          theme,
          registrationMarks: export3d.registrationMarks,
          pxPerMm,
        });
        zip.file(`poster-${base}.png`, await canvasToPngBlob(canvas));
        const stl = exportRouteStl(posterSize, gpxData.points, markers, export3d, theme.mapRotationDeg);
        zip.file(`rute-${base}.stl`, stl.stl);
        zipName = `poster-${base}-full.zip`;
      } else {
        const base = slug(collection.expeditionTitle, "ekspedisi");
        const canvas = await renderCollectionPoster({ posterSize, collection, pxPerMm, theme });
        zip.file(`poster-koleksi-${base}.png`, await canvasToPngBlob(canvas));
        for (const h of hikesWithGpx) {
          const index = collection.hikes.findIndex((x) => x.id === h.id);
          const blockSize = collectionBlockSize(posterSize, collection.hikes.length, index);
          const rot = h.mapRotationDeg ?? 0;
          const hikeBase = slug(h.mountainName, `gunung-${index + 1}`);
          const stl = exportRouteStl(blockSize, h.gpxData!.points, syntheticMarkers(h), export3d, rot);
          zip.file(`rute-${hikeBase}.stl`, stl.stl);
        }
        zipName = `poster-koleksi-${base}-full.zip`;
      }

      // Resi pengiriman (10x15 cm) — hanya ada bila pesanan sudah diimpor.
      if (shipping) {
        const resiBase = slug(shipping.penerima, "penerima");
        zip.file(`resi-${resiBase}.png`, await canvasToPngBlob(renderResiCanvas(shipping)));
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Gagal export full.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={disabled}
      title="Export Full — ZIP berisi PNG + STL + resi"
      className="clay-btn flex items-center gap-1.5 bg-gradient-to-r from-[#b8532f] to-[#8f3d20] px-3 py-2 text-xs font-medium text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60 sm:px-3.5 sm:text-sm"
    >
      {busy ? <Loader2 size={13} className="animate-spin" /> : <FolderDown size={13} />}
      <span className="hidden sm:inline">Export Full</span>
    </button>
  );
}
