"use client";

import { Palette } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { compressImageToDataUrl } from "@/lib/image";
import { DEFAULT_PHOTO_TRANSFORM } from "@/lib/photoTransform";
import { BACKGROUND_THEMES } from "@/lib/backgroundThemes";
import PhotoCropper from "@/components/PhotoCropper";
import type { MapTheme } from "@/types";

const THEME_OPTIONS: { id: MapTheme; label: string; swatch: string }[] = [
  { id: "voyager", label: "Voyager", swatch: "#c9dfef" },
  { id: "voyager_nolabels", label: "Voyager Polos", swatch: "#d7e6d2" },
  { id: "light", label: "Light", swatch: "#f4f4f5" },
  { id: "light_nolabels", label: "Light Polos", swatch: "#e6e6e9" },
  { id: "dark", label: "Dark", swatch: "#18181b" },
  { id: "dark_nolabels", label: "Dark Polos", swatch: "#26262b" },
  { id: "topo", label: "Topografi", swatch: "#d9cdb0" },
];

export default function ThemeSelector() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const posterSize = useAppStore((s) => s.posterSize);

  // Crop frame = the whole poster, so the on-screen crop is WYSIWYG with export.
  const bgAspect = posterSize.widthMm / posterSize.heightMm;

  const handleBgFile = async (file: File) => {
    const dataUrl = await compressImageToDataUrl(file);
    setTheme({ backgroundImage: dataUrl, backgroundImageTransform: DEFAULT_PHOTO_TRANSFORM });
  };

  return (
    <div className="clay-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
          <Palette size={15} />
        </span>
        Tema & Gaya Peta
      </h2>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setTheme({ theme: opt.id })}
            className={`clay-tile flex flex-col items-center gap-1.5 px-2 py-2 text-center text-xs font-medium transition-colors ${
              theme.theme === opt.id
                ? "border-[#d97757] text-[#9c4a2c] dark:border-[#d97757] dark:text-[#e59a7c]"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            }`}
          >
            <span
              className="h-6 w-6 rounded-full border border-black/10"
              style={{ background: opt.swatch }}
            />
            {opt.label}
          </button>
        ))}
      </div>

      <label className="mt-4 block text-sm text-zinc-600 dark:text-zinc-300">
        <div className="flex items-center justify-between">
          <span>Rotasi peta</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-500">{theme.mapRotationDeg}°</span>
            {theme.mapRotationDeg !== 0 && (
              <button
                type="button"
                onClick={() => setTheme({ mapRotationDeg: 0 })}
                className="text-xs text-[#c05d3d] hover:underline"
              >
                Reset
              </button>
            )}
          </span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={5}
          value={theme.mapRotationDeg}
          onChange={(e) => setTheme({ mapRotationDeg: Number(e.target.value) })}
          className="mt-1 w-full"
        />
        <p className="mt-0.5 text-xs text-zinc-400">
          0° = utara di atas. Putar mis. 180° kalau mau puncak di atas — rute, peta, SVG & STL ikut berputar bersama.
        </p>
      </label>

      <label className="mt-4 block text-sm text-zinc-600 dark:text-zinc-300">
        Transparansi tint di atas peta ({Math.round(theme.tintOpacity * 100)}%)
        <input
          type="range"
          min={0}
          max={0.8}
          step={0.05}
          value={theme.tintOpacity}
          onChange={(e) => setTheme({ tintOpacity: Number(e.target.value) })}
          className="mt-2 w-full"
        />
      </label>

      <label className="mt-3 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-300">
        Warna tint
        <input
          type="color"
          value={theme.tintColor}
          onChange={(e) => setTheme({ tintColor: e.target.value })}
          className="h-8 w-14 cursor-pointer rounded-lg border border-zinc-300 dark:border-zinc-700"
        />
      </label>

      <div className="my-4 border-t border-dashed border-zinc-200 dark:border-zinc-800" />

      {/* Tema latar poster (preset gradasi). */}
      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        <span className="font-medium">Tema latar poster</span>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {BACKGROUND_THEMES.map((bt) => (
            <button
              key={bt.id}
              type="button"
              onClick={() => setTheme({ backgroundTheme: bt.id })}
              className={`clay-tile flex flex-col items-center gap-1 px-1 py-2 text-center text-[11px] font-medium transition-colors ${
                (theme.backgroundTheme ?? "sunset") === bt.id
                  ? "border-[#d97757] text-[#9c4a2c] dark:border-[#d97757] dark:text-[#e59a7c]"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              }`}
            >
              <span className="h-7 w-7 rounded-full border border-black/10" style={{ background: bt.css }} />
              {bt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="my-4 border-t border-dashed border-zinc-200 dark:border-zinc-800" />

      {/* Background poster: foto opsional di atas gradasi sunset. */}
      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        <span className="font-medium">Foto background poster</span>
        <p className="mt-0.5 text-xs text-zinc-400">
          Foto jadi latar poster, dicampur di atas warna sunset. Drag untuk geser, scroll / slider untuk zoom.
        </p>

        <div className="mt-3">
          <PhotoCropper
            label="Background poster"
            value={theme.backgroundImage}
            transform={theme.backgroundImageTransform ?? DEFAULT_PHOTO_TRANSFORM}
            aspect={bgAspect}
            onFile={handleBgFile}
            onTransformChange={(t) => setTheme({ backgroundImageTransform: t })}
            onRemove={() =>
              setTheme({ backgroundImage: undefined, backgroundImageTransform: DEFAULT_PHOTO_TRANSFORM })
            }
          />
        </div>

        {theme.backgroundImage && (
          <>
            <label className="mt-3 block">
              Transparansi foto ({Math.round(theme.backgroundImageOpacity * 100)}%)
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={theme.backgroundImageOpacity}
                onChange={(e) => setTheme({ backgroundImageOpacity: Number(e.target.value) })}
                className="mt-2 w-full"
              />
              <p className="mt-0.5 text-xs text-zinc-400">
                0% = warna sunset penuh · 100% = foto penuh.
              </p>
            </label>
            <label className="mt-3 block text-sm text-zinc-600 dark:text-zinc-300">
              <div className="flex items-center justify-between">
                <span>Kecerahan foto background</span>
                <span className="font-mono text-xs text-zinc-500">{(theme.backgroundImageBrightness ?? 1).toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2}
                step={0.05}
                value={theme.backgroundImageBrightness ?? 1}
                onChange={(e) => setTheme({ backgroundImageBrightness: Number(e.target.value) })}
                className="mt-2 w-full"
              />
            </label>
          </>
        )}

        <label className="mt-4 block text-sm text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center justify-between">
            <span>Kecerahan gradien background</span>
            <span className="font-mono text-xs text-zinc-500">{(theme.gradientBrightness ?? 1).toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.05}
            value={theme.gradientBrightness ?? 1}
            onChange={(e) => setTheme({ gradientBrightness: Number(e.target.value) })}
            className="mt-2 w-full"
          />
        </label>
      </div>
    </div>
  );
}
