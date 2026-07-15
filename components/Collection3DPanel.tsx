"use client";

import { useState } from "react";
import { Box, FileCode, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { collectionBlockSize } from "@/lib/exportCollectionPng";
import { exportRouteSvg, downloadTextFile } from "@/lib/exportSvg";
import { exportRouteStl, downloadArrayBuffer } from "@/lib/exportStl";
import type { CollectionHike, RouteMarker } from "@/types";

/**
 * Export 3D print (1:1) untuk poster koleksi. Tiap gunung diexport TERPISAH
 * (satu STL/SVG per jalur) karena tiap potongan dicetak & ditempel di blok
 * petanya sendiri. Geometrinya diambil dari collectionBlockSize — sumber yang
 * SAMA dengan renderer poster — jadi skalanya presisi 1:1 dengan cetakan.
 */
export default function Collection3DPanel() {
  const posterSize = useAppStore((s) => s.posterSize);
  const collection = useAppStore((s) => s.collection);
  const export3d = useAppStore((s) => s.export3d);
  const setExport3d = useAppStore((s) => s.setExport3d);

  const [busy, setBusy] = useState<string | null>(null);
  const [readout, setReadout] = useState<string | null>(null);

  const hikes = collection.hikes;
  const withGpx = hikes.filter((h) => h.gpxData && h.gpxData.points.length >= 2);
  if (withGpx.length === 0) return null;

  const syntheticMarkers = (hike: CollectionHike): RouteMarker[] => {
    const n = hike.gpxData!.points.length;
    return [
      { id: `${hike.id}-bc`, type: "basecamp", label: "Basecamp", trackIndex: 0 },
      { id: `${hike.id}-sm`, type: "summit", label: "Puncak", trackIndex: n - 1 },
    ];
  };

  const baseName = (hike: CollectionHike, index: number) =>
    (hike.mountainName || `gunung-${index + 1}`).replace(/\s+/g, "-").toLowerCase();

  const handleExport = (hike: CollectionHike, kind: "svg" | "stl") => {
    const index = hikes.findIndex((h) => h.id === hike.id);
    setBusy(`${hike.id}-${kind}`);
    setTimeout(() => {
      try {
        const blockSize = collectionBlockSize(posterSize, hikes.length, index);
        const rot = hike.mapRotationDeg ?? 0;
        if (kind === "svg") {
          const res = exportRouteSvg(blockSize, hike.gpxData!.points, syntheticMarkers(hike), export3d, rot);
          downloadTextFile(res.svg, `rute-${baseName(hike, index)}.svg`, "image/svg+xml");
          setReadout(
            `SVG ${hike.mountainName || index + 1}: peta blok ${res.mapAreaMm.width.toFixed(1)}×${res.mapAreaMm.height.toFixed(1)} mm · bbox rute ${res.bboxMm.width.toFixed(1)}×${res.bboxMm.height.toFixed(1)} mm`
          );
        } else {
          const res = exportRouteStl(blockSize, hike.gpxData!.points, syntheticMarkers(hike), export3d, rot);
          downloadArrayBuffer(res.stl, `rute-${baseName(hike, index)}.stl`);
          setReadout(
            `STL ${hike.mountainName || index + 1}: peta blok ${res.mapAreaMm.width.toFixed(1)}×${res.mapAreaMm.height.toFixed(1)} mm · bbox rute ${res.bboxMm.width.toFixed(1)}×${res.bboxMm.height.toFixed(1)} mm`
          );
        }
      } catch (e) {
        setReadout(e instanceof Error ? e.message : "Gagal export.");
      } finally {
        setBusy(null);
      }
    }, 30);
  };

  return (
    <div className="clay-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
          <Box size={15} />
        </span>
        Export 3D Print (1:1)
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Satu file per gunung — tiap jalur dicetak terpisah lalu ditempel presis di
        blok petanya. Skala mm-nya sama persis dengan poster.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center justify-between">
            <span>Lebar garis rute</span>
            <span className="font-mono text-xs text-zinc-500">{export3d.lineWidthMm.toFixed(1)} mm</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={6}
            step={0.1}
            value={export3d.lineWidthMm}
            onChange={(e) => setExport3d({ lineWidthMm: Number(e.target.value) })}
            className="mt-1 w-full accent-amber-500"
          />
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center justify-between">
            <span>Tinggi extrude (STL)</span>
            <span className="font-mono text-xs text-zinc-500">{export3d.extrudeHeightMm.toFixed(1)} mm</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={6}
            step={0.1}
            value={export3d.extrudeHeightMm}
            onChange={(e) => setExport3d({ extrudeHeightMm: Number(e.target.value) })}
            className="mt-1 w-full accent-amber-500"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {withGpx.map((h) => {
          const index = hikes.findIndex((x) => x.id === h.id);
          return (
            <div key={h.id} className="clay-well flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {index + 1}. {h.mountainName || `Pendakian ${index + 1}`}
              </span>
              <span className="flex w-full gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleExport(h, "svg")}
                  disabled={busy !== null}
                  className="clay-tile flex flex-1 items-center justify-center gap-1.5 border-amber-300 px-3 py-2.5 text-xs font-medium text-amber-800 transition-colors disabled:opacity-60 sm:flex-none sm:py-1.5 dark:border-amber-800/60 dark:text-amber-300"
                >
                  {busy === `${h.id}-svg` ? <Loader2 size={13} className="animate-spin" /> : <FileCode size={13} />}
                  SVG
                </button>
                <button
                  type="button"
                  onClick={() => handleExport(h, "stl")}
                  disabled={busy !== null}
                  className="clay-btn flex flex-1 items-center justify-center gap-1.5 bg-[#d97757] px-3 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[#c05d3d] disabled:opacity-60 sm:flex-none sm:py-1.5"
                >
                  {busy === `${h.id}-stl` ? <Loader2 size={13} className="animate-spin" /> : <Box size={13} />}
                  STL
                </button>
              </span>
            </div>
          );
        })}
      </div>

      {readout && (
        <p className="mt-3 rounded-md bg-amber-50 p-2 font-mono text-[11px] leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-300/90">
          {readout}
        </p>
      )}
    </div>
  );
}
