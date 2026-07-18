"use client";

import { useCallback, useRef, useState } from "react";
import { Clapperboard, Loader2, Mountain, Plus, Route, Trash2, UploadCloud } from "lucide-react";
import { useAppStore, MAX_COLLECTION_HIKES, MIN_COLLECTION_HIKES } from "@/lib/store";
import { parseGpxFile } from "@/lib/gpxParser";
import { buildCollectionReplayPayload, isReplayUrl, replayPath } from "@/lib/replay";
import RouteBuilderModal from "@/components/RouteBuilderModal";
import { compressImageToDataUrl } from "@/lib/image";
import { DEFAULT_PHOTO_TRANSFORM } from "@/lib/photoTransform";
import PhotoCropper from "@/components/PhotoCropper";
import Collection3DPanel from "@/components/Collection3DPanel";
import { collectionPhotoAspect } from "@/lib/exportCollectionPng";
import { BACKGROUND_THEMES } from "@/lib/backgroundThemes";
import type { CollectionHike } from "@/types";

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-800 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600";
const labelClass = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

/** Dropzone GPX ringkas untuk satu kartu pendakian. */
function HikeGpxUpload({ hike }: { hike: CollectionHike }) {
  const setHikeGpx = useAppStore((s) => s.setHikeGpx);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setLoading(true);
      try {
        const result = await parseGpxFile(file);
        setHikeGpx(hike.id, file.name, result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memproses file GPX.");
      } finally {
        setLoading(false);
      }
    },
    [hike.id, setHikeGpx]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
          dragOver
            ? "border-[#d97757] bg-[#f7e9e1] dark:bg-[#3a2a22]"
            : "border-zinc-300 hover:border-[#d97757] hover:bg-[#f7e9e1]/60 dark:border-zinc-700 dark:hover:border-[#a8552f] dark:hover:bg-[#3a2a22]/40"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gpx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = "";
          }}
        />
        <UploadCloud size={18} className={dragOver ? "text-[#d97757]" : "text-zinc-400 dark:text-zinc-500"} />
        <p className="text-xs text-zinc-600 dark:text-zinc-300">
          {loading ? "Memproses..." : hike.gpxFileName ? `Ganti GPX (${hike.gpxFileName})` : "Klik / drop file .gpx"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setBuilderOpen(true)}
        className="clay-tile mt-2 flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#9c4a2c] transition-colors hover:text-[#7d3a22] dark:text-[#e59a7c] dark:hover:text-[#f0b79f]"
      >
        <Route size={13} />
        Buat jalur tanpa GPX
      </button>
      {builderOpen && (
        <RouteBuilderModal
          onGenerated={(fileName, result) => setHikeGpx(hike.id, fileName, result)}
          onClose={() => setBuilderOpen(false)}
        />
      )}
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      {hike.gpxData && !error && (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {hike.gpxData.points.length} titik · {hike.distanceKm.toFixed(2)} km · +{Math.round(hike.elevationGainM)} m
        </p>
      )}
    </div>
  );
}

function HikeCard({ hike, index }: { hike: CollectionHike; index: number }) {
  const updateHike = useAppStore((s) => s.updateHike);
  const removeHike = useAppStore((s) => s.removeHike);
  const hikeCount = useAppStore((s) => s.collection.hikes.length);
  const posterSize = useAppStore((s) => s.posterSize);
  // Rasio frame foto di poster (tergantung jumlah gunung) → cropper WYSIWYG.
  const photoAspect = collectionPhotoAspect(posterSize, hikeCount);

  const patch = (p: Partial<CollectionHike>) => updateHike(hike.id, p);

  const handlePhoto = async (file: File) => {
    const dataUrl = await compressImageToDataUrl(file);
    patch({ climberPhoto: dataUrl, climberPhotoTransform: DEFAULT_PHOTO_TRANSFORM });
  };

  return (
    <div className="clay-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-xs font-bold text-white">
            {index + 1}
          </span>
          {hike.mountainName || `Pendakian ${index + 1}`}
        </h3>
        {hikeCount > MIN_COLLECTION_HIKES && (
          <button
            type="button"
            onClick={() => removeHike(hike.id)}
            className="flex items-center gap-1 text-xs text-zinc-400 transition-colors hover:text-red-500"
            aria-label="Hapus pendakian"
          >
            <Trash2 size={13} />
            Hapus
          </button>
        )}
      </div>

      <HikeGpxUpload hike={hike} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className={labelClass}>
          Nama gunung
          <input
            type="text"
            placeholder="Gunung Sindoro"
            value={hike.mountainName}
            onChange={(e) => patch({ mountainName: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Via / jalur
          <input
            type="text"
            placeholder="Via Kledung"
            value={hike.viaRoute}
            onChange={(e) => patch({ viaRoute: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Tanggal
          <input
            type="text"
            placeholder="8 Sept 2025"
            value={hike.date}
            onChange={(e) => patch({ date: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Lama pendakian
          <input
            type="text"
            placeholder="2 Hari 1 Malam"
            value={hike.duration}
            onChange={(e) => patch({ duration: e.target.value })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Ketinggian (mdpl)
          <input
            type="number"
            value={hike.summitElevationM}
            onChange={(e) => patch({ summitElevationM: Number(e.target.value) })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Jarak (km)
          <input
            type="number"
            step="0.01"
            value={hike.distanceKm}
            onChange={(e) => patch({ distanceKm: Number(e.target.value) })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Elevation gain (m)
          <input
            type="number"
            value={hike.elevationGainM}
            onChange={(e) => patch({ elevationGainM: Number(e.target.value) })}
            className={inputClass}
          />
        </label>
        <label className={labelClass}>
          Waktu tempuh
          <input
            type="text"
            placeholder="03:34:44"
            value={hike.movingTime}
            onChange={(e) => patch({ movingTime: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-3 flex items-start gap-4">
        <div className="w-28 shrink-0">
          <span className={labelClass}>Foto pendaki</span>
          <div className="mt-1">
            <PhotoCropper
              label="Foto pendaki"
              value={hike.climberPhoto}
              transform={hike.climberPhotoTransform ?? DEFAULT_PHOTO_TRANSFORM}
              aspect={photoAspect}
              onFile={handlePhoto}
              onTransformChange={(t) => patch({ climberPhotoTransform: t })}
              onRemove={() => patch({ climberPhoto: undefined, climberPhotoTransform: DEFAULT_PHOTO_TRANSFORM })}
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Warna jalur 3D
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={hike.routeColor}
                onChange={(e) => patch({ routeColor: e.target.value })}
                className="h-8 w-14 cursor-pointer rounded-lg border border-zinc-300 dark:border-zinc-700"
              />
              <span className="font-mono text-xs text-zinc-400">{hike.routeColor}</span>
            </div>
          </label>
          <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <div className="flex items-center justify-between">
              <span>Rotasi peta</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-zinc-400">{hike.mapRotationDeg ?? 0}°</span>
                {(hike.mapRotationDeg ?? 0) !== 0 && (
                  <button
                    type="button"
                    onClick={() => patch({ mapRotationDeg: 0 })}
                    className="text-[#c05d3d] hover:underline"
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
              value={hike.mapRotationDeg ?? 0}
              onChange={(e) => patch({ mapRotationDeg: Number(e.target.value) })}
              className="mt-1 w-full"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

export default function CollectionEditor() {
  const collection = useAppStore((s) => s.collection);
  const setCollectionMeta = useAppStore((s) => s.setCollectionMeta);
  const addHike = useAppStore((s) => s.addHike);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const { hikes } = collection;
  const totalElevation = hikes.reduce((sum, h) => sum + (h.summitElevationM || 0), 0);
  const totalDistance = hikes.reduce((sum, h) => sum + (h.distanceKm || 0), 0);
  const totalGain = hikes.reduce((sum, h) => sum + (h.elevationGainM || 0), 0);

  // Summit Replay koleksi: satu QR memutar tiap gunung ber-GPX bergantian.
  const replayEligible = hikes.filter((h) => h.gpxData && h.gpxData.points.length >= 2).length;
  const [replayBusy, setReplayBusy] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  const handleCreateReplay = async () => {
    if (replayEligible === 0 || replayBusy) return;
    setReplayBusy(true);
    setReplayError(null);
    try {
      const res = await fetch("/api/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCollectionReplayPayload(collection)),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string } | null;
      if (!res.ok || !json?.ok || !json.id) {
        setReplayError(json?.error ?? "Gagal membuat replay.");
        return;
      }
      setCollectionMeta({ qrCodeUrl: `${window.location.origin}${replayPath(json.id)}` });
    } catch {
      setReplayError("Gagal terhubung ke server.");
    } finally {
      setReplayBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Ekspedisi */}
      <div className="clay-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-sm">
            <Mountain size={15} />
          </span>
          Ekspedisi
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Judul besar & deskripsi yang tampil di bagian bawah poster koleksi.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Judul ekspedisi
            <input
              type="text"
              placeholder="Ekspedisi Triple-S Raga Sejati"
              value={collection.expeditionTitle}
              onChange={(e) => setCollectionMeta({ expeditionTitle: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            Nama pendaki
            <input
              type="text"
              placeholder="Raihan Fauzan"
              value={collection.climberName}
              onChange={(e) => setCollectionMeta({ climberName: e.target.value })}
              className={inputClass}
            />
          </label>
        </div>
        <label className={`${labelClass} mt-3 block`}>
          Deskripsi / quote
          <textarea
            rows={2}
            placeholder="Tiga gunung, ribuan meter ketinggian, satu tujuan: pulang membawa cerita tak terlupakan."
            value={collection.expeditionDesc}
            onChange={(e) => setCollectionMeta({ expeditionDesc: e.target.value })}
            className={inputClass}
          />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Instagram
            <input
              type="text"
              placeholder="@handle"
              value={collection.instagram}
              onChange={(e) => setCollectionMeta({ instagram: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className={labelClass}>
            TikTok
            <input
              type="text"
              placeholder="@handle"
              value={collection.tiktok}
              onChange={(e) => setCollectionMeta({ tiktok: e.target.value })}
              className={inputClass}
            />
          </label>
        </div>
        <label className={`${labelClass} mt-3 block`}>
          Link QR code
          <input
            type="url"
            placeholder="https://strava.com/... / linktr.ee/... (bebas, boleh kosong)"
            value={collection.qrCodeUrl}
            onChange={(e) => setCollectionMeta({ qrCodeUrl: e.target.value })}
            className={inputClass}
          />
        </label>
        {/* Summit Replay: QR memutar animasi tiap gunung bergantian. */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCreateReplay}
            disabled={replayEligible === 0 || replayBusy}
            title="QR diarahkan ke halaman animasi pergerakan basecamp → puncak per gunung"
            className="clay-chip flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#9c4a2c] transition-colors disabled:opacity-50 dark:text-[#e59a7c]"
          >
            {replayBusy ? <Loader2 size={13} className="animate-spin" /> : <Clapperboard size={13} />}
            {isReplayUrl(collection.qrCodeUrl) ? "Buat ulang Summit Replay" : "Buat Summit Replay"}
          </button>
          {isReplayUrl(collection.qrCodeUrl) ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              QR = Summit Replay ({replayEligible} gunung) ✓{" "}
              <a href={collection.qrCodeUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                buka
              </a>
            </span>
          ) : replayEligible === 0 ? (
            <span className="text-xs text-zinc-400">Upload GPX minimal 1 gunung dulu</span>
          ) : (
            <span className="text-xs text-zinc-400">{replayEligible} gunung ber-GPX ikut replay</span>
          )}
        </div>
        {replayError && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{replayError}</p>}
        <div className="mt-3">
          <span className={labelClass}>Tema latar poster</span>
          <div className="mt-1.5 grid grid-cols-4 gap-2">
            {BACKGROUND_THEMES.map((bt) => (
              <button
                key={bt.id}
                type="button"
                onClick={() => setCollectionMeta({ backgroundTheme: bt.id })}
                className={`clay-tile flex flex-col items-center gap-1 px-1 py-2 text-center text-[11px] font-medium transition-colors ${
                  (collection.backgroundTheme ?? "sunset") === bt.id
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
        <label className="mt-4 block text-sm text-zinc-600 dark:text-zinc-300">
          <div className="flex items-center justify-between">
            <span>Kecerahan background gradien</span>
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
          <p className="mt-0.5 text-xs text-zinc-400">
            Geser ke kanan untuk menerangkan warna latar belakang gradien.
          </p>
        </label>
      </div>

      {/* Kartu pendakian */}
      {/* 1 kolom: editor sekarang hidup di kolom kanan yang ramping. */}
      <div className="grid grid-cols-1 gap-6">
        {hikes.map((h, i) => (
          <HikeCard key={h.id} hike={h} index={i} />
        ))}
        {hikes.length < MAX_COLLECTION_HIKES && (
          <button
            type="button"
            onClick={addHike}
            className="clay-tile flex min-h-[160px] flex-col items-center justify-center gap-2 p-6 text-sm font-medium text-zinc-500 transition-colors hover:text-[#9c4a2c] dark:text-zinc-400 dark:hover:text-[#e59a7c]"
          >
            <Plus size={22} />
            Tambah pendakian ({hikes.length}/{MAX_COLLECTION_HIKES})
          </button>
        )}
      </div>

      {/* Ringkasan total */}
      <div className="clay-well grid grid-cols-3 gap-3 p-4 text-center">
        <Stat label="Total Ketinggian" value={`${totalElevation.toLocaleString("id-ID")} mdpl`} />
        <Stat label="Total Jarak" value={`${totalDistance.toFixed(2)} km`} />
        <Stat label="Total Elev Gain" value={`+${Math.round(totalGain)} m`} />
      </div>

      {/* Export 3D print per gunung */}
      <Collection3DPanel />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-zinc-800 dark:text-zinc-100">{value}</div>
    </div>
  );
}
