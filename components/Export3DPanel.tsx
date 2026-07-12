"use client";

import { useState } from "react";
import { Box, FileCode, Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { exportRouteSvg, downloadTextFile } from "@/lib/exportSvg";
import { exportRouteStl, downloadArrayBuffer } from "@/lib/exportStl";

export default function Export3DPanel() {
  const posterSize = useAppStore((s) => s.posterSize);
  const gpxData = useAppStore((s) => s.gpxData);
  const markers = useAppStore((s) => s.markers);
  const stats = useAppStore((s) => s.stats);
  const export3d = useAppStore((s) => s.export3d);
  const setExport3d = useAppStore((s) => s.setExport3d);
  const mapRotationDeg = useAppStore((s) => s.theme.mapRotationDeg);

  const [busy, setBusy] = useState<null | "svg" | "stl">(null);
  const [readout, setReadout] = useState<string | null>(null);

  if (!gpxData) return null;

  const baseName = (stats.mountainName || "gpx-summit").replace(/\s+/g, "-").toLowerCase();

  const handleSvg = () => {
    setBusy("svg");
    try {
      const res = exportRouteSvg(posterSize, gpxData.points, markers, export3d, mapRotationDeg);
      downloadTextFile(res.svg, `rute-${baseName}.svg`, "image/svg+xml");
      const msg = `SVG 1:1 — area peta ${res.mapAreaMm.width.toFixed(1)}×${res.mapAreaMm.height.toFixed(1)} mm · bbox rute ${res.bboxMm.width.toFixed(1)}×${res.bboxMm.height.toFixed(1)} mm`;
      setReadout(msg);
      // eslint-disable-next-line no-console
      console.log("[SVG 1:1]", msg);
    } catch (e) {
      setReadout(e instanceof Error ? e.message : "Gagal export SVG.");
    } finally {
      setBusy(null);
    }
  };

  const handleStl = () => {
    setBusy("stl");
    // defer so the spinner can paint before the (sync) heavy work
    setTimeout(() => {
      try {
        const res = exportRouteStl(posterSize, gpxData.points, markers, export3d, mapRotationDeg);
        downloadArrayBuffer(res.stl, `rute-${baseName}.stl`);
        const msg = `STL 1:1 — area peta ${res.mapAreaMm.width.toFixed(1)}×${res.mapAreaMm.height.toFixed(1)} mm · bbox rute ${res.bboxMm.width.toFixed(1)}×${res.bboxMm.height.toFixed(1)} mm`;
        setReadout(msg);
        // eslint-disable-next-line no-console
        console.log("[STL 1:1]", msg);
      } catch (e) {
        setReadout(e instanceof Error ? e.message : "Gagal export STL.");
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
        Rute jadi ribbon solid berskala mm asli — cocok ditempel presis di atas rute poster cetak.
      </p>

      <div className="mt-4 flex flex-col gap-4">
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

        <Toggle
          label="Tinggi mengikuti elevasi (topografi)"
          hint="Jalur naik-turun mengikuti profil. Bagus untuk dipajang, kurang cocok ditempel rata di poster."
          checked={export3d.elevationZ}
          onChange={(v) => setExport3d({ elevationZ: v })}
        />
        <Toggle
          label="Sertakan pin marker"
          hint="Basecamp / pos / puncak jadi silinder kecil di posisi yang sama."
          checked={export3d.includeMarkers}
          onChange={(v) => setExport3d({ includeMarkers: v })}
        />
        <Toggle
          label="Tanda registrasi (alignment)"
          hint="Cross-hair di 2 sudut peta pada poster + SVG. STL hanya berisi rute (tanpa titik pojok) agar muat di bed printer — saat menempel, cocokkan langsung dengan garis rute di poster."
          checked={export3d.registrationMarks}
          onChange={(v) => setExport3d({ registrationMarks: v })}
        />
      </div>

      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={handleSvg}
          disabled={busy !== null}
          className="clay-tile flex flex-1 items-center justify-center gap-2 border-amber-300 px-3 py-2.5 text-sm font-medium text-amber-800 transition-colors disabled:opacity-60 dark:border-amber-800/60 dark:text-amber-300"
        >
          {busy === "svg" ? <Loader2 size={16} className="animate-spin" /> : <FileCode size={16} />}
          Export SVG
        </button>
        <button
          type="button"
          onClick={handleStl}
          disabled={busy !== null}
          className="clay-btn flex flex-1 items-center justify-center gap-2 bg-[#d97757] px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#c05d3d] disabled:opacity-60"
        >
          {busy === "stl" ? <Loader2 size={16} className="animate-spin" /> : <Box size={16} />}
          Export STL
        </button>
      </div>

      {readout && (
        <p className="mt-3 rounded-md bg-amber-50 p-2 font-mono text-[11px] leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-300/90">
          {readout}
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-zinc-700 dark:text-zinc-200">{label}</div>
        <div className="text-xs text-zinc-400">{hint}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
          checked ? "bg-amber-500" : "bg-zinc-300 dark:bg-zinc-700"
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  );
}
