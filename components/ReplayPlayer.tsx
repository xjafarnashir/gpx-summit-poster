"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUpRight, Mountain, Pause, Play, RotateCcw } from "lucide-react";
import { CARTO_STYLE_URL } from "@/lib/tileFetcher";
import { buildMarkerElement } from "@/lib/mapIcons";
import { haversineMeters } from "@/lib/geo";
import { parseHmsToSeconds, secondsToHms } from "@/lib/statFormat";
import type { ReplayData, ReplayHike } from "@/lib/replay";
import type { TrackPoint } from "@/types";

/* ============================================================================
 * Pemutar Summit Replay (halaman publik hasil scan QR poster).
 * Marker bergerak dari basecamp ke puncak mengikuti jalur; garis progres
 * memanjang; profil elevasi berjalan; jam menampilkan f × movingTime
 * (sintesis kecepatan-konstan — GPX tanpa timestamp).
 * ========================================================================== */

const BASE_DURATION_MS = 35_000; // durasi animasi penuh pada speed 1x
const SPEEDS = [1, 2, 4] as const;
const FULL_SOURCE = "replay-full";
const PROGRESS_SOURCE = "replay-progress";

interface HikeGeom {
  coords: [number, number][]; // [lon, lat]
  cumDist: number[]; // meter kumulatif per titik
  totalDist: number;
  eleMin: number;
  eleMax: number;
  totalSeconds: number;
}

function buildGeom(hike: ReplayHike): HikeGeom {
  const coords = hike.points.map(([lat, lon]) => [lon, lat] as [number, number]);
  const cumDist: number[] = [0];
  for (let i = 1; i < hike.points.length; i++) {
    const a: TrackPoint = { lat: hike.points[i - 1][0], lon: hike.points[i - 1][1], ele: 0 };
    const b: TrackPoint = { lat: hike.points[i][0], lon: hike.points[i][1], ele: 0 };
    cumDist.push(cumDist[i - 1] + haversineMeters(a, b));
  }
  const eles = hike.points.map((p) => p[2]);
  return {
    coords,
    cumDist,
    totalDist: Math.max(cumDist[cumDist.length - 1], 1e-6),
    eleMin: Math.min(...eles),
    eleMax: Math.max(...eles),
    totalSeconds: parseHmsToSeconds(hike.movingTime),
  };
}

/** Posisi + elevasi pada fraksi jarak f (0..1): binary search cumDist + lerp. */
function pointAtFraction(hike: ReplayHike, geom: HikeGeom, f: number): { lngLat: [number, number]; ele: number; idx: number } {
  const target = Math.min(Math.max(f, 0), 1) * geom.totalDist;
  let lo = 0;
  let hi = geom.cumDist.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (geom.cumDist[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  const i = Math.max(1, lo);
  const d0 = geom.cumDist[i - 1];
  const d1 = geom.cumDist[i];
  const t = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
  const [lat0, lon0, ele0] = hike.points[i - 1];
  const [lat1, lon1, ele1] = hike.points[i];
  return {
    lngLat: [lon0 + (lon1 - lon0) * t, lat0 + (lat1 - lat0) * t],
    ele: ele0 + (ele1 - ele0) * t,
    idx: i - 1,
  };
}

const emptyLine = () =>
  ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } }) as GeoJSON.Feature;

const lineTo = (coords: [number, number][]) =>
  ({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }) as GeoJSON.Feature;

/** Marker pendaki: dot merah berdenyut (kelas Tailwind global berlaku juga di elemen DOM). */
function buildHikerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "relative flex h-4 w-4";
  el.innerHTML =
    '<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ef4444] opacity-50"></span>' +
    '<span class="relative inline-flex h-4 w-4 rounded-full border-2 border-white bg-[#ef4444] shadow"></span>';
  return el;
}

export default function ReplayPlayer({ data }: { data: ReplayData }) {
  const hikes: ReplayHike[] = useMemo(() => (data.kind === "single" ? [data] : data.hikes), [data]);
  const geoms = useMemo(() => hikes.map(buildGeom), [hikes]);

  const reducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [finishedAll, setFinishedAll] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const hike = hikes[activeIdx];
  const geom = geoms[activeIdx];

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const hikerMarkerRef = useRef<maplibregl.Marker | null>(null);
  const endpointMarkersRef = useRef<maplibregl.Marker[]>([]);
  const elevCanvasRef = useRef<HTMLCanvasElement>(null);
  const elevStaticRef = useRef<HTMLCanvasElement | null>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const eleReadoutRef = useRef<HTMLSpanElement>(null);

  const fRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef<number>(1);
  const activeIdxRef = useRef(0);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    playingRef.current = playing;
    speedRef.current = speed;
    activeIdxRef.current = activeIdx;
  }, [playing, speed, activeIdx]);

  /* ------------------------- profil elevasi statis ------------------------ */

  const drawStaticElevation = useCallback(() => {
    const cv = elevCanvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth * dpr;
    const hpx = cv.clientHeight * dpr;
    cv.width = w;
    cv.height = hpx;

    const g = geoms[activeIdxRef.current];
    const h = hikes[activeIdxRef.current];
    const off = document.createElement("canvas");
    off.width = w;
    off.height = hpx;
    const ctx = off.getContext("2d");
    if (!ctx) return;

    const pad = 8 * dpr;
    const range = Math.max(g.eleMax - g.eleMin, 1);
    const xAt = (i: number) => (g.cumDist[i] / g.totalDist) * w;
    const yAt = (ele: number) => hpx - pad - ((ele - g.eleMin) / range) * (hpx - pad * 2);

    ctx.beginPath();
    ctx.moveTo(0, hpx);
    for (let i = 0; i < h.points.length; i++) ctx.lineTo(xAt(i), yAt(h.points[i][2]));
    ctx.lineTo(w, hpx);
    ctx.closePath();
    ctx.fillStyle = "rgba(217,119,87,0.18)";
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < h.points.length; i++) {
      const x = xAt(i);
      const y = yAt(h.points[i][2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#d97757";
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    ctx.fillStyle = "rgba(120,120,120,0.9)";
    ctx.font = `${10 * dpr}px monospace`;
    ctx.textBaseline = "top";
    ctx.fillText(`${Math.round(g.eleMax)} m`, 4 * dpr, 3 * dpr);
    ctx.textBaseline = "bottom";
    ctx.fillText(`${Math.round(g.eleMin)} m`, 4 * dpr, hpx - 3 * dpr);

    elevStaticRef.current = off;
  }, [geoms, hikes]);

  /* ------------------------------- peta ---------------------------------- */

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: CARTO_STYLE_URL.voyager,
      center: geoms[0].coords[0],
      zoom: 12,
      attributionControl: { compact: true },
    });

    map.on("load", () => {
      map.addSource(FULL_SOURCE, { type: "geojson", data: emptyLine() });
      map.addLayer({
        id: FULL_SOURCE,
        type: "line",
        source: FULL_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#d97757", "line-width": 3, "line-opacity": 0.25 },
      });
      map.addSource(PROGRESS_SOURCE, { type: "geojson", data: emptyLine() });
      map.addLayer({
        id: PROGRESS_SOURCE,
        type: "line",
        source: PROGRESS_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#d97757", "line-width": 4.5, "line-opacity": 0.95 },
      });
      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      hikerMarkerRef.current = null;
      endpointMarkersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Gambar keseluruhan frame animasi pada fraksi f (marker, garis, elevasi, jam). */
  const renderFrame = useCallback(
    (f: number) => {
      const map = mapRef.current;
      const h = hikes[activeIdxRef.current];
      const g = geoms[activeIdxRef.current];
      if (!map || !map.isStyleLoaded()) return;

      const { lngLat, ele, idx } = pointAtFraction(h, g, f);

      hikerMarkerRef.current?.setLngLat(lngLat);
      const progress = g.coords.slice(0, idx + 1).concat([lngLat]);
      (map.getSource(PROGRESS_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(lineTo(progress));

      // Profil elevasi: blit statis + kursor + dot.
      const cv = elevCanvasRef.current;
      const staticCv = elevStaticRef.current;
      if (cv && staticCv) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, cv.width, cv.height);
          ctx.drawImage(staticCv, 0, 0);
          const x = f * cv.width;
          const pad = 8 * (cv.width / cv.clientWidth || 1);
          const range = Math.max(g.eleMax - g.eleMin, 1);
          const y = cv.height - pad - ((ele - g.eleMin) / range) * (cv.height - pad * 2);
          ctx.strokeStyle = "rgba(217,119,87,0.9)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, cv.height);
          ctx.stroke();
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.stroke();
        }
      }

      if (clockRef.current) clockRef.current.textContent = secondsToHms(f * g.totalSeconds);
      if (eleReadoutRef.current) eleReadoutRef.current.textContent = `${Math.round(ele)} mdpl`;
    },
    [geoms, hikes]
  );

  /* --------------------- muat/hike aktif ke peta -------------------------- */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    (map.getSource(FULL_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(lineTo(geom.coords));
    (map.getSource(PROGRESS_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(emptyLine());

    // Marker ujung (basecamp/puncak) + marker pendaki.
    endpointMarkersRef.current.forEach((m) => m.remove());
    const mk = (type: "basecamp" | "summit", lngLat: [number, number]) => {
      const el = buildMarkerElement(type);
      el.style.cursor = "default";
      el.style.width = "22px";
      el.style.height = "22px";
      return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat(lngLat).addTo(map);
    };
    endpointMarkersRef.current = [mk("basecamp", geom.coords[0]), mk("summit", geom.coords[geom.coords.length - 1])];

    if (!hikerMarkerRef.current) {
      hikerMarkerRef.current = new maplibregl.Marker({ element: buildHikerElement(), anchor: "center" })
        .setLngLat(geom.coords[0])
        .addTo(map);
    } else {
      hikerMarkerRef.current.setLngLat(geom.coords[0]);
    }

    const bounds = geom.coords.reduce(
      (b, c) => b.extend(c),
      new maplibregl.LngLatBounds(geom.coords[0], geom.coords[0])
    );
    map.fitBounds(bounds, { padding: 46, duration: 800 });

    drawStaticElevation();
    renderFrame(fRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeIdx]);

  useEffect(() => {
    const onResize = () => {
      drawStaticElevation();
      renderFrame(fRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [drawStaticElevation, renderFrame]);

  /* ----------------------------- loop animasi ----------------------------- */

  useEffect(() => {
    let raf = 0;
    let lastTs = 0;

    const tick = (ts: number) => {
      raf = requestAnimationFrame(tick);
      if (!playingRef.current || !mapRef.current) {
        lastTs = ts;
        return;
      }
      const dt = lastTs ? ts - lastTs : 0;
      lastTs = ts;

      fRef.current = Math.min(1, fRef.current + (dt / BASE_DURATION_MS) * speedRef.current);
      renderFrame(fRef.current);

      if (fRef.current >= 1) {
        setPlaying(false);
        const idx = activeIdxRef.current;
        if (idx < hikes.length - 1) {
          // Koleksi: jeda sejenak lalu lanjut gunung berikutnya.
          advanceTimerRef.current = setTimeout(() => {
            fRef.current = 0;
            setActiveIdx(idx + 1);
            setPlaying(true);
          }, 1500);
        } else {
          setFinishedAll(true);
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [hikes.length, renderFrame]);

  // Autoplay begitu peta siap (kecuali preferensi reduced-motion → tampil akhir).
  useEffect(() => {
    if (!mapReady) return;
    const t = setTimeout(() => {
      if (reducedMotion) {
        fRef.current = 1;
        renderFrame(1);
        setFinishedAll(true);
      } else {
        setPlaying(true);
      }
    }, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady]);

  /* ------------------------------- kontrol -------------------------------- */

  const switchHike = (idx: number, autoplay: boolean) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    fRef.current = 0;
    setFinishedAll(false);
    setActiveIdx(idx);
    setPlaying(autoplay);
  };

  const handlePlayPause = () => {
    if (fRef.current >= 1 && !playing) {
      // Selesai → play lagi = ulang dari awal (gunung aktif).
      fRef.current = 0;
      setFinishedAll(false);
    }
    setPlaying((p) => !p);
  };

  const handleRestart = () => switchHike(data.kind === "collection" ? 0 : activeIdx, true);

  const cycleSpeed = () => setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);

  /* --------------------------------- UI ----------------------------------- */

  const title = data.kind === "single" ? data.name : data.title;
  const subtitle =
    data.kind === "single"
      ? [data.via ? `via ${data.via}` : null, data.date].filter(Boolean).join(" · ")
      : [data.climber, `${hikes.length} gunung`].filter(Boolean).join(" · ");

  return (
    <div className="min-h-screen">
      {/* header brand + CTA */}
      <header className="sticky top-0 z-40 px-4 pt-3 pb-1">
        <div className="clay-card mx-auto flex h-14 max-w-lg items-center justify-between gap-3 !rounded-full px-4">
          <Link href="/landingpage" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white">
              <Mountain size={16} />
            </span>
            <span className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">myKoordinat</span>
          </Link>
          <Link
            href="/landingpage"
            className="clay-chip flex shrink-0 items-center gap-1 px-3.5 py-2 text-xs font-semibold text-[#9c4a2c] dark:text-[#e59a7c]"
          >
            Pesan postermu
            <ArrowUpRight size={12} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pb-10 pt-4">
        {/* judul */}
        <div className="px-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#b8532f] dark:text-[#e59a7c]">
            Summit Replay
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#3d3929] dark:text-[#f0eee4]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
        </div>

        {/* tab gunung (koleksi) */}
        {hikes.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {hikes.map((h, i) => (
              <button
                key={i}
                type="button"
                onClick={() => switchHike(i, true)}
                className={`clay-chip px-3 py-1.5 text-xs font-semibold transition-colors ${
                  i === activeIdx
                    ? "text-[#9c4a2c] dark:text-[#e59a7c]"
                    : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                }`}
              >
                {i + 1}. {h.name}
              </button>
            ))}
          </div>
        )}

        {/* peta */}
        <div className="clay-card mt-3 overflow-hidden !rounded-2xl p-2">
          <div ref={mapContainerRef} className="h-[45vh] min-h-[280px] w-full overflow-hidden rounded-xl" />
        </div>

        {/* profil elevasi + readout */}
        <div className="clay-card mt-3 p-3">
          <div className="flex items-baseline justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">Profil Elevasi</span>
            <span className="flex items-baseline gap-3 font-mono text-xs text-zinc-600 dark:text-zinc-300">
              <span ref={eleReadoutRef}>{Math.round(geom.eleMin)} mdpl</span>
              {geom.totalSeconds > 0 && (
                <span ref={clockRef} className="font-semibold text-[#b8532f] dark:text-[#e59a7c]">
                  00:00:00
                </span>
              )}
            </span>
          </div>
          <canvas ref={elevCanvasRef} className="mt-2 h-24 w-full" />
        </div>

        {/* kontrol */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handlePlayPause}
            className="clay-btn flex items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-5 py-2.5 text-sm font-semibold text-white"
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
            {playing ? "Pause" : finishedAll ? "Putar lagi" : "Putar"}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            title="Ulangi dari awal"
            className="clay-chip flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-zinc-600 dark:text-zinc-300"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={cycleSpeed}
            title="Kecepatan animasi"
            className="clay-chip px-3.5 py-2.5 font-mono text-sm font-semibold text-zinc-600 dark:text-zinc-300"
          >
            {speed}x
          </button>
        </div>

        {/* statistik */}
        <div className="clay-card mt-3 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <Stat label="Ketinggian" value={`${hike.stats.summitElevationM.toLocaleString("id-ID")}`} unit="mdpl" />
          <Stat label="Jarak" value={hike.stats.distanceKm.toFixed(2)} unit="km" />
          <Stat label="Elev Gain" value={`+${hike.stats.elevationGainM}`} unit="m" />
          <Stat label="Waktu" value={geom.totalSeconds > 0 ? hike.movingTime : "—"} unit="" />
        </div>

        <p className="mt-5 text-center text-xs text-zinc-400 dark:text-zinc-500">
          Poster pendakian custom dari file GPX —{" "}
          <Link href="/landingpage" className="font-semibold text-[#b8532f] underline-offset-2 hover:underline dark:text-[#e59a7c]">
            myKoordinat
          </Link>
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="text-center">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-400">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-zinc-900 dark:text-zinc-50">
        {value}
        {unit && <span className="ml-1 text-[10px] font-semibold text-zinc-400">{unit}</span>}
      </div>
    </div>
  );
}
