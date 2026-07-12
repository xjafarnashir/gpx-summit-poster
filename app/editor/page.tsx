"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import CollectionCanvas from "@/components/CollectionCanvas";
import CollectionEditor from "@/components/CollectionEditor";
import GpxUpload from "@/components/GpxUpload";
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
        actions={
          <>
            <button
              type="button"
              onClick={handleFillSample}
              className="clay-btn flex items-center gap-1.5 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-3 py-1.5 text-xs font-medium text-white transition-all hover:-translate-y-0.5 sm:px-3.5 sm:text-sm"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Isi Contoh Data</span>
              <span className="sm:hidden">Contoh</span>
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="clay-chip flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-600 transition-colors hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 sm:px-3.5 sm:text-sm"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </>
        }
      />
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 lg:min-h-0 lg:overflow-hidden">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/"
              className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <ChevronLeft size={14} />
              Ubah ukuran
            </Link>
            <h1 className="mt-1 text-xl font-extrabold tracking-tight text-[#3d3929] sm:text-2xl dark:text-[#f0eee4]">
              {posterMode === "collection" ? "Editor Poster Koleksi" : "Editor Poster"}
            </h1>
          </div>
        </header>

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
          <div className="flex flex-col gap-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
            <CollectionCanvas />
            <CollectionEditor />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[1fr_360px] lg:overflow-hidden">
            <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <MapEditor />
              <PosterCanvas />
            </div>
            <div className="flex flex-col gap-6 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
              <GpxUpload />
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
