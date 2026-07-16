"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Loader2, MapPin, Route, Search, Trash2, Undo2, X } from "lucide-react";
import { CARTO_STYLE_URL } from "@/lib/tileFetcher";
import { buildRoute, searchPlaces, type PlaceResult, type Waypoint } from "@/lib/routeBuilder";
import type { GpxParseResult } from "@/types";

const LINE_SOURCE_ID = "wp-line";
const LINE_LAYER_ID = "wp-line-layer";
/** Pusat awal peta (Jawa Tengah — banyak gunung). Admin bisa geser bebas. */
const DEFAULT_CENTER: [number, number] = [110.2, -7.3];

type Mode = "follow" | "straight";

/** Marker bulat bernomor; titik pertama = start, terakhir = puncak. */
function makeWpMarker(label: string, kind: "start" | "mid" | "end"): HTMLDivElement {
  const bg = kind === "start" ? "#0ea5e9" : kind === "end" ? "#ef4444" : "#f59e0b";
  const el = document.createElement("div");
  el.style.cssText =
    "width:26px;height:26px;border-radius:50%;border:2px solid white;" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;" +
    "font:700 12px system-ui,sans-serif;color:white;" +
    `background:${bg};box-shadow:0 1px 4px rgba(0,0,0,0.45)`;
  el.textContent = label;
  return el;
}

export default function RouteBuilderModal({
  onGenerated,
  onClose,
}: {
  onGenerated: (fileName: string, result: GpxParseResult) => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRefs = useRef<maplibregl.Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [mode, setMode] = useState<Mode>("follow");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Pencarian lokasi (Nominatim): hasil yang dipilih jadi titik berikutnya.
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Init map sekali.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: CARTO_STYLE_URL.topo,
      center: DEFAULT_CENTER,
      zoom: 9,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    const addLineLayer = () => {
      if (map.getSource(LINE_SOURCE_ID)) return;
      map.addSource(LINE_SOURCE_ID, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } },
      });
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: LINE_SOURCE_ID,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#d6381d", "line-width": 4, "line-opacity": 0.9 },
      });
    };

    map.on("load", () => {
      addLineLayer();
      setReady(true);
    });
    map.on("click", (e) => {
      setWaypoints((prev) => [...prev, { lat: e.lngLat.lat, lon: e.lngLat.lng }]);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current = [];
    };
  }, []);

  // Sinkronkan marker + garis tiap waypoints berubah.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = waypoints.map((w, i) => {
      const kind = i === 0 ? "start" : i === waypoints.length - 1 ? "end" : "mid";
      const el = makeWpMarker(String(i + 1), waypoints.length === 1 ? "start" : kind);
      return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([w.lon, w.lat]).addTo(map);
    });

    const src = map.getSource(LINE_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    src?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: waypoints.map((w) => [w.lon, w.lat]) },
    });
  }, [waypoints, ready]);

  const undo = () => setWaypoints((p) => p.slice(0, -1));
  const clearAll = () => setWaypoints([]);

  const handleSearch = async () => {
    if (!query.trim() || searching) return;
    setSearching(true);
    setSearchError(null);
    setResults([]);
    try {
      const found = await searchPlaces(query);
      if (found.length === 0) setSearchError("Lokasi tidak ditemukan — coba kata kunci lain.");
      setResults(found);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Pencarian gagal.");
    } finally {
      setSearching(false);
    }
  };

  /** Pilih hasil pencarian: terbang ke lokasi + jadikan titik berikutnya. */
  const pickPlace = (p: PlaceResult) => {
    setWaypoints((prev) => [...prev, { lat: p.lat, lon: p.lon }]);
    mapRef.current?.flyTo({ center: [p.lon, p.lat], zoom: 13, duration: 1200 });
    setResults([]);
    setQuery("");
  };

  const handleBuild = async () => {
    if (waypoints.length < 2) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const { result, usedFallback } = await buildRoute(waypoints, mode);
      if (mode === "follow" && usedFallback) {
        setNote("Jalur belum terpetakan — dipakai garis lurus. Tambah titik tengah untuk merapikan.");
      }
      onGenerated("Jalur dibuat manual", result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat jalur.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="clay-card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-md">
              <Route size={18} />
            </span>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Buat jalur tanpa GPX</h3>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                Klik di peta: titik <strong>start</strong>, (opsional titik tengah), lalu <strong>puncak</strong>.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>

        {/* cari lokasi → jadi titik berikutnya (pertama = start, terakhir = puncak) */}
        <div className="relative mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              placeholder="Cari lokasi awal / akhir: basecamp, puncak, desa…"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={!query.trim() || searching}
              className="clay-tile flex shrink-0 items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#9c4a2c] transition-colors disabled:opacity-50 dark:text-[#e59a7c]"
            >
              {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              Cari
            </button>
          </div>
          {searchError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{searchError}</p>}
          {results.length > 0 && (
            <ul className="clay-card absolute left-0 right-0 top-full z-20 mt-2 max-h-56 overflow-y-auto !rounded-xl p-2">
              {results.map((p, i) => (
                <li key={`${p.lat}-${p.lon}-${i}`}>
                  <button
                    type="button"
                    onClick={() => pickPlace(p)}
                    className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-[#f7e9e1] dark:hover:bg-[#3a2a22]"
                  >
                    <span className="block text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {p.name}
                      <span className="ml-2 font-normal text-[11px] text-[#9c4a2c] dark:text-[#e59a7c]">
                        → jadi titik {waypoints.length === 0 ? "start" : `#${waypoints.length + 1}`}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">{p.displayName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* mode */}
        <div className="clay-well mb-3 inline-flex w-fit gap-1 p-1">
          {(["follow", "straight"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === m
                  ? "bg-gradient-to-r from-[#d97757] to-[#b8532f] text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              }`}
            >
              {m === "follow" ? "Ikuti jalur (otomatis)" : "Garis lurus"}
            </button>
          ))}
        </div>

        <div className="relative overflow-hidden rounded-xl">
          <div ref={containerRef} className="h-[52vh] w-full" />
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-zinc-600 shadow-md dark:bg-zinc-800/90 dark:text-zinc-300">
            <MapPin size={12} />
            {waypoints.length === 0
              ? "Klik peta untuk menaruh titik start"
              : `${waypoints.length} titik · start biru, puncak merah`}
          </div>
        </div>

        {note && <p className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{note}</p>}
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={waypoints.length === 0 || busy}
              className="clay-tile flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors disabled:opacity-50 dark:text-zinc-300"
            >
              <Undo2 size={14} /> Undo
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={waypoints.length === 0 || busy}
              className="clay-tile flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors disabled:opacity-50 dark:text-zinc-300"
            >
              <Trash2 size={14} /> Hapus semua
            </button>
          </div>
          <button
            type="button"
            onClick={handleBuild}
            disabled={waypoints.length < 2 || busy}
            className="clay-btn flex items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Route size={16} />}
            Buat jalur
          </button>
        </div>
      </div>
    </div>
  );
}
