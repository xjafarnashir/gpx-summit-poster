"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import CollectionCanvas from "@/components/CollectionCanvas";
import CollectionEditor from "@/components/CollectionEditor";
import ExportFullButton from "@/components/ExportFullButton";
import ExportPngButton from "@/components/ExportPngButton";
import GpxUpload from "@/components/GpxUpload";
import ImportOrderPanel from "@/components/ImportOrderPanel";
import MapEditor from "@/components/MapEditor";
import MarkerList from "@/components/MarkerList";
import ThemeSelector from "@/components/ThemeSelector";
import StatCardForm from "@/components/StatCardForm";
import PosterCanvas from "@/components/PosterCanvas";
import Export3DPanel from "@/components/Export3DPanel";
import { useAppStore } from "@/lib/store";
import { SAMPLE_POS_MARKERS, buildSampleStats } from "@/lib/sampleData";
import type { RouteMarker } from "@/types";

export default function EditorPage() {
  const router = useRouter();
  const gpxData = useAppStore((s) => s.gpxData);
  const posterMode = useAppStore((s) => s.posterMode);
  const hasHydrated = useAppStore((s) => s.hasHydrated);
  const reset = useAppStore((s) => s.reset);
  const markers = useAppStore((s) => s.markers);
  const setMarkers = useAppStore((s) => s.setMarkers);
  const setStats = useAppStore((s) => s.setStats);
  const storageWarning = useAppStore((s) => s.storageWarning);
  const setStorageWarning = useAppStore((s) => s.setStorageWarning);

  if (!hasHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-950">
        Memuat…
      </div>
    );
  }

  const handleReset = () => {
    if (confirm("Reset semua data (ukuran, GPX, marker, stat)? Tindakan ini tidak bisa dibatalkan.")) {
      reset();
      router.replace("/");
    }
  };

  const handleFillSample = () => {
    if (!gpxData) return;
    const n = gpxData.points.length;

    // Add sample pos markers (keep existing basecamp/summit, replace old pos).
    const keep = markers.filter((m) => m.type !== "pos");
    const samplePos: RouteMarker[] = SAMPLE_POS_MARKERS.map((p, i) => ({
      id: crypto.randomUUID(),
      type: "pos",
      label: p.label,
      trackIndex: Math.min(n - 1, Math.max(1, Math.floor(n * p.fraction))),
      order: i,
    }));
    setMarkers([...keep, ...samplePos]);

    setStats({
      ...buildSampleStats(gpxData.distanceKm),
      summitElevationM: Math.round(gpxData.maxEle),
    });
  };

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <AppHeader
        wide
        actions={
          <>
            <Link
              href="/"
              title="Ubah ukuran poster"
              className="clay-chip flex items-center gap-1 px-3 py-2 text-xs text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 sm:px-3.5 sm:text-sm"
            >
              <ChevronLeft size={13} />
              <span className="hidden sm:inline">Ubah ukuran</span>
            </Link>
            <ImportOrderPanel />
            <button
              type="button"
              onClick={handleFillSample}
              title="Isi contoh data"
              className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-600 transition-colors hover:text-[#9c4a2c] dark:text-zinc-300 dark:hover:text-[#e59a7c] sm:px-3.5 sm:text-sm"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Isi Contoh Data</span>
            </button>
            <ExportPngButton />
            <ExportFullButton />
            <button
              type="button"
              onClick={handleReset}
              title="Reset semua data"
              className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-600 transition-colors hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 sm:px-3.5 sm:text-sm"
            >
              <RotateCcw size={13} />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </>
        }
      />
      <div className="flex w-full flex-1 flex-col px-4 py-4 lg:min-h-0 lg:overflow-hidden xl:px-8">
        {storageWarning && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-300">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">{storageWarning}</p>
            <button
              type="button"
              onClick={() => setStorageWarning(null)}
              className="shrink-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
              aria-label="Tutup"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {posterMode === "collection" ? (
          /* Preview KIRI tanpa scroll (poster selalu utuh), input KANAN. */
          <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden">
            <div className="flex flex-col lg:min-h-0 lg:overflow-hidden">
              <CollectionCanvas />
            </div>
            <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <CollectionEditor />
            </div>
          </div>
        ) : (
          /* Preview KIRI tanpa scroll; peta editor ikut kolom input di kanan. */
          <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_420px] lg:overflow-hidden">
            <div className="flex flex-col lg:min-h-0 lg:overflow-hidden">
              <PosterCanvas />
            </div>
            <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <GpxUpload />
              <MapEditor />
              <MarkerList />
              <ThemeSelector />
              <StatCardForm />
              <Export3DPanel />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
