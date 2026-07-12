"use client";

import { LayoutTemplate } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { PosterOrientation, PosterPresetId } from "@/types";

const PRESET_OPTIONS: { id: PosterPresetId; label: string; sub: string }[] = [
  { id: "A4", label: "A4", sub: "210 × 297 mm" },
  { id: "A3", label: "A3", sub: "297 × 420 mm" },
  { id: "A2", label: "A2", sub: "420 × 594 mm" },
  { id: "A1", label: "A1", sub: "594 × 841 mm" },
  { id: "custom", label: "Custom", sub: "mm bebas" },
];

export default function SizeSetup() {
  const sizeSetup = useAppStore((s) => s.sizeSetup);
  const posterSize = useAppStore((s) => s.posterSize);
  const setSizeSetup = useAppStore((s) => s.setSizeSetup);
  const posterMode = useAppStore((s) => s.posterMode);
  const setPosterMode = useAppStore((s) => s.setPosterMode);

  const MODE_OPTIONS: { id: typeof posterMode; label: string; sub: string }[] = [
    { id: "single", label: "1 Pendakian", sub: "Satu gunung, satu poster" },
    { id: "collection", label: "Koleksi", sub: "2-3 gunung dalam 1 poster" },
  ];

  return (
    <div className="clay-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
          <LayoutTemplate size={15} />
        </span>
        1. Jenis & Ukuran Poster
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Semua layout & export (PNG, SVG, STL) diturunkan dari ukuran fisik ini agar skalanya 1:1.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setPosterMode(opt.id)}
            className={`clay-tile px-3 py-2.5 text-left text-sm transition-colors ${
              posterMode === opt.id
                ? "border-[#d97757] text-[#9c4a2c] dark:border-[#d97757] dark:text-[#e59a7c]"
                : "text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            }`}
          >
            <div className="font-semibold">{opt.label}</div>
            <div className="text-xs opacity-70">{opt.sub}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSizeSetup({ preset: opt.id })}
            className={`clay-tile px-3 py-2 text-left text-sm transition-colors ${
              sizeSetup.preset === opt.id
                ? "border-[#d97757] text-[#9c4a2c] dark:border-[#d97757] dark:text-[#e59a7c]"
                : "text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            }`}
          >
            <div className="font-medium">{opt.label}</div>
            <div className="text-xs opacity-70">{opt.sub}</div>
          </button>
        ))}
      </div>

      {sizeSetup.preset === "custom" && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm text-zinc-600 dark:text-zinc-300">
            Width (mm)
            <input
              type="number"
              min={50}
              value={sizeSetup.customWidthMm}
              onChange={(e) => setSizeSetup({ customWidthMm: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="text-sm text-zinc-600 dark:text-zinc-300">
            Height (mm)
            <input
              type="number"
              min={50}
              value={sizeSetup.customHeightMm}
              onChange={(e) => setSizeSetup({ customHeightMm: Number(e.target.value) })}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {(["portrait", "landscape"] as PosterOrientation[]).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setSizeSetup({ orientation: o })}
            className={`clay-tile flex-1 px-3 py-2 text-sm capitalize transition-colors ${
              sizeSetup.orientation === o
                ? "border-[#d97757] text-[#9c4a2c] dark:border-[#d97757] dark:text-[#e59a7c]"
                : "text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            }`}
          >
            {o === "portrait" ? "Portrait" : "Landscape"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          DPI export PNG
          <input
            type="number"
            min={72}
            step={1}
            value={sizeSetup.dpi}
            onChange={(e) => setSizeSetup({ dpi: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="text-sm text-zinc-600 dark:text-zinc-300">
          Margin peta (mm)
          <input
            type="number"
            min={0}
            step={1}
            value={sizeSetup.marginMm}
            onChange={(e) => setSizeSetup({ marginMm: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
      </div>

      <div className="clay-well mt-5 p-3 text-xs text-[#6b6250] dark:text-[#cfc9b8]">
        <div>
          Poster: <span className="font-mono">{posterSize.widthMm} × {posterSize.heightMm} mm</span> @ {posterSize.dpi} DPI ={" "}
          <span className="font-mono">
            {Math.round((posterSize.widthMm * posterSize.dpi) / 25.4)} × {Math.round((posterSize.heightMm * posterSize.dpi) / 25.4)} px
          </span>
        </div>
        <div>
          Area peta: <span className="font-mono">{posterSize.mapAreaMm.width.toFixed(1)} × {posterSize.mapAreaMm.height.toFixed(1)} mm</span>
        </div>
      </div>
    </div>
  );
}
