"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { computeAvgPace } from "@/lib/statFormat";
import { compressImageToDataUrl } from "@/lib/image";
import { STAT_ICONS } from "@/lib/iconMap";
import { computeLandscapePhotoFrames, computePhotoFrames } from "@/lib/posterLayout";
import { isLandscapeSize } from "@/lib/projection";
import { DEFAULT_PHOTO_TRANSFORM } from "@/lib/photoTransform";
import PhotoCropper from "@/components/PhotoCropper";
import type { PhotoTransform, SummitStats } from "@/types";

function FieldRow({
  icon: Icon,
  label,
  children,
}: {
  icon: (typeof STAT_ICONS)[keyof typeof STAT_ICONS];
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <Icon size={16} />
      </span>
      <span className="w-28 shrink-0">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600";

export default function StatCardForm() {
  const stats = useAppStore((s) => s.stats);
  const setStats = useAppStore((s) => s.setStats);
  const posterSize = useAppStore((s) => s.posterSize);

  const [manualPace, setManualPace] = useState(false);

  useEffect(() => {
    if (manualPace) return;
    const auto = computeAvgPace(stats.distanceKm, stats.movingTime);
    if (auto && auto !== stats.avgPace) setStats({ avgPace: auto });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.distanceKm, stats.movingTime, manualPace]);

  const patch = (p: Partial<SummitStats>) => setStats(p);

  // Crop frame aspect must match the actual poster photo frame (depends on how
  // many photos are present), so the on-screen crop is WYSIWYG with the export.
  const photoCount = [stats.summitPhoto, stats.landscapePhoto].filter(Boolean).length;
  const frame = isLandscapeSize(posterSize)
    ? computeLandscapePhotoFrames(posterSize, Math.max(photoCount, 1))[0]
    : computePhotoFrames(posterSize, stats, Math.max(photoCount, 1))[0];
  const photoAspect = frame.wMm / frame.hMm;

  const handlePhotoFile = async (slot: "summit" | "landscape", file: File) => {
    // High-quality re-encode; safeStorage degrades gracefully if it can't fit.
    const dataUrl = await compressImageToDataUrl(file);
    if (slot === "summit") patch({ summitPhoto: dataUrl, summitPhotoTransform: DEFAULT_PHOTO_TRANSFORM });
    else patch({ landscapePhoto: dataUrl, landscapePhotoTransform: DEFAULT_PHOTO_TRANSFORM });
  };

  const setPhotoTransform = (slot: "summit" | "landscape", t: PhotoTransform) => {
    if (slot === "summit") patch({ summitPhotoTransform: t });
    else patch({ landscapePhotoTransform: t });
  };

  return (
    <div className="clay-card p-6">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
          <STAT_ICONS.mountainName size={15} />
        </span>
        Summit Activity
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Semua field bisa diedit manual.</p>

      <div className="mt-4 flex flex-col gap-3">
        <FieldRow icon={STAT_ICONS.distance} label="Distance">
          <input
            type="number"
            step="0.01"
            value={stats.distanceKm}
            onChange={(e) => patch({ distanceKm: Number(e.target.value) })}
            className={inputClass}
          />
          <span className="text-xs text-zinc-400">km</span>
        </FieldRow>

        <FieldRow icon={STAT_ICONS.elevationGain} label="Elev. Gain">
          <input
            type="number"
            value={stats.elevationGainM}
            onChange={(e) => patch({ elevationGainM: Number(e.target.value) })}
            className={inputClass}
          />
          <span className="text-xs text-zinc-400">m</span>
        </FieldRow>

        <FieldRow icon={STAT_ICONS.mountainName} label="Puncak">
          <input
            type="number"
            value={stats.summitElevationM ?? 0}
            onChange={(e) => patch({ summitElevationM: Number(e.target.value) })}
            className={inputClass}
          />
          <span className="text-xs text-zinc-400">mdpl</span>
        </FieldRow>

        <FieldRow icon={STAT_ICONS.movingTime} label="Moving Time">
          <input
            type="text"
            placeholder="HH:MM:SS"
            value={stats.movingTime}
            onChange={(e) => patch({ movingTime: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.avgPace} label="Avg Pace">
          <input
            type="text"
            placeholder="MM:SS/km"
            value={stats.avgPace}
            onChange={(e) => {
              setManualPace(true);
              patch({ avgPace: e.target.value });
            }}
            className={inputClass}
          />
          {manualPace && (
            <button
              type="button"
              onClick={() => {
                setManualPace(false);
                patch({ avgPace: computeAvgPace(stats.distanceKm, stats.movingTime) });
              }}
              className="text-xs text-[#c05d3d] hover:underline"
            >
              Auto
            </button>
          )}
        </FieldRow>

        <FieldRow icon={STAT_ICONS.temperature} label="Temperature">
          <input
            type="text"
            placeholder="Contoh: 18°C"
            value={stats.temperature}
            onChange={(e) => patch({ temperature: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.weather} label="Weather">
          <input
            type="text"
            placeholder="Contoh: Cerah"
            value={stats.weather}
            onChange={(e) => patch({ weather: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <div className="my-1 border-t border-dashed border-zinc-200 dark:border-zinc-800" />

        <FieldRow icon={STAT_ICONS.viaRoute} label="Label Atas">
          <input
            type="text"
            placeholder="RUTE PENDAKIAN"
            value={stats.headerLabel ?? ""}
            onChange={(e) => patch({ headerLabel: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.climberName} label="Nama">
          <input
            type="text"
            placeholder="Nama pendaki"
            value={stats.climberName}
            onChange={(e) => patch({ climberName: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.mountainName} label="Gunung">
          <input
            type="text"
            placeholder="Nama gunung"
            value={stats.mountainName}
            onChange={(e) => patch({ mountainName: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.date} label="Tanggal">
          <input
            type="text"
            placeholder="Contoh: 14 Juni 2026"
            value={stats.date}
            onChange={(e) => patch({ date: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.viaRoute} label="Via">
          <input
            type="text"
            placeholder="Jalur pendakian"
            value={stats.viaRoute}
            onChange={(e) => patch({ viaRoute: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.instagram} label="Instagram">
          <input
            type="text"
            placeholder="@handle"
            value={stats.instagram ?? ""}
            onChange={(e) => patch({ instagram: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.tiktok} label="TikTok">
          <input
            type="text"
            placeholder="@handle"
            value={stats.tiktok ?? ""}
            onChange={(e) => patch({ tiktok: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <FieldRow icon={STAT_ICONS.qrCode} label="QR Strava">
          <input
            type="url"
            placeholder="https://strava.com/activities/..."
            value={stats.qrCodeUrl ?? ""}
            onChange={(e) => patch({ qrCodeUrl: e.target.value })}
            className={inputClass}
          />
        </FieldRow>

        <div className="my-1 border-t border-dashed border-zinc-200 dark:border-zinc-800" />

        <div className="flex gap-3">
          <PhotoCropper
            label="Foto Summit"
            value={stats.summitPhoto}
            transform={stats.summitPhotoTransform ?? DEFAULT_PHOTO_TRANSFORM}
            aspect={photoAspect}
            onFile={(f) => handlePhotoFile("summit", f)}
            onTransformChange={(t) => setPhotoTransform("summit", t)}
            onRemove={() => patch({ summitPhoto: undefined, summitPhotoTransform: DEFAULT_PHOTO_TRANSFORM })}
          />
          <PhotoCropper
            label="Foto Landscape"
            value={stats.landscapePhoto}
            transform={stats.landscapePhotoTransform ?? DEFAULT_PHOTO_TRANSFORM}
            aspect={photoAspect}
            onFile={(f) => handlePhotoFile("landscape", f)}
            onTransformChange={(t) => setPhotoTransform("landscape", t)}
            onRemove={() => patch({ landscapePhoto: undefined, landscapePhotoTransform: DEFAULT_PHOTO_TRANSFORM })}
          />
        </div>
        <p className="text-xs text-zinc-400">
          Foto tampil di kolom kanan poster. Geser & zoom untuk atur bagian yang tampil — bingkainya tetap.
        </p>
      </div>
    </div>
  );
}
