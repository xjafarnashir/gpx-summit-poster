"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUpRight, Boxes, Mountain, Pause, Play, RotateCcw } from "lucide-react";
import { CARTO_STYLE_URL } from "@/lib/tileFetcher";
import { buildMarkerElement } from "@/lib/mapIcons";
import { haversineMeters } from "@/lib/geo";
import { parseHmsToSeconds, secondsToHms } from "@/lib/statFormat";
import type { ReplayData, ReplayHike } from "@/lib/replay";
import type { TrackPoint } from "@/types";

/* ============================================================================
 * Pemutar Summit Replay (halaman publik hasil scan QR poster).
 * Marker bergerak dari basecamp ke puncak mengikuti jalur di atas RELIEF 3D
 * asli, kamera miring mengikuti pendaki (flyby ala Strava). Garis progres
 * memanjang; profil elevasi berjalan; jam menampilkan f × movingTime
 * (sintesis kecepatan-konstan — GPX tanpa timestamp). Bisa dialihkan ke 2D.
 * ========================================================================== */

const BASE_DURATION_MS = 35_000; // durasi animasi penuh pada speed 1x
const SPEEDS = [1, 2, 4] as const;
const FULL_SOURCE = "replay-full";
const PROGRESS_SOURCE = "replay-progress";
const DEM_SOURCE = "replay-dem";
const HILLSHADE_LAYER = "replay-hillshade";

/** DEM Terrarium AWS (gratis, CORS *) untuk relief 3D. */
const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_EXAGGERATION = 1.7; // lebih dramatis supaya gunung/lembah menonjol
const FOLLOW_PITCH = 74; // sangat miring → pandangan rendah menyusur medan
const FOLLOW_ZOOM = 14.3; // dekat, khas chase-cam di belakang pendaki
const OVERVIEW_PITCH_3D = 52; // overview tetap miring di mode 3D
/** Chase-cam: kamera MEMANDANG titik ~sekian meter DI DEPAN pendaki, sehingga
 *  pendaki berada di sepertiga bawah layar dan medan/puncak terbentang di
 *  depannya — view "dari belakang" ala flyby Strava. */
const CHASE_LOOKAT_M = 450;
/** Arah hadap kamera dihitung dari titik sedikit di depan (anti-goyang). */
const CHASE_BEARING_M = 140;

/** Bearing (derajat, -180..180) dari a ke b, keduanya [lng, lat]. */
function bearingDeg(a: [number, number], b: [number, number]): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const lat1 = toR(a[1]);
  const lat2 = toR(b[1]);
  const dLon = toR(b[0] - a[0]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** Interpolasi sudut dengan penanganan wrap 360°. */
function lerpAngle(a: number, b: number, k: number): number {
  const d = ((b - a + 540) % 360) - 180;
  return a + d * k;
}

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
  const [mode3d, setMode3d] = useState(true);

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
  // Kamera follow 3D: state kamera yang di-lerp tiap frame agar mulus.
  const mode3dRef = useRef(true);
  const followActiveRef = useRef(false);
  const camRef = useRef({ lng: 0, lat: 0, bearing: 0, pitch: 0, zoom: 0 });

  useEffect(() => {
    playingRef.current = playing;
    speedRef.current = speed;
    activeIdxRef.current = activeIdx;
    mode3dRef.current = mode3d;
  }, [playing, speed, activeIdx, mode3d]);

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
      maxPitch: 80, // default MapLibre 60 → naikkan agar flyby lebih miring
      attributionControl: { compact: true },
    });

    // Pakai "style.load" (bukan "load"): menyala saat style selesai di-parse,
    // TIDAK menunggu tile basemap — kalau CDN tile lambat/terblokir, animasi +
    // rute + terrain tetap jalan. `once`-style guard cegah setup ganda.
    let didSetup = false;
    const setup = () => {
      if (didSetup) return;
      didSetup = true;

      // DEM + HILLSHADE dulu (best-effort) supaya relief benar-benar TERLIHAT
      // (lembah/punggungan terbayang), bukan cuma geometri terangkat yang
      // tampak datar di basemap vektor. Ditaruh sebelum garis rute → rute di
      // atas relief. Kegagalan di sini tak boleh mematikan animasi.
      try {
        map.addSource(DEM_SOURCE, {
          type: "raster-dem",
          tiles: [TERRARIUM_URL],
          encoding: "terrarium",
          tileSize: 256,
          maxzoom: 15,
          attribution: "Terrain: Mapzen/Terrarium · AWS",
        });
        map.addLayer({
          id: HILLSHADE_LAYER,
          type: "hillshade",
          source: DEM_SOURCE,
          paint: {
            "hillshade-exaggeration": 0.6,
            "hillshade-shadow-color": "#3a2f27",
            "hillshade-highlight-color": "#fff6e8",
            "hillshade-accent-color": "#5a4a3a",
          },
        });
      } catch {
        /* hillshade opsional */
      }

      // CORE (garis) — di atas hillshade.
      map.addSource(FULL_SOURCE, { type: "geojson", data: emptyLine() });
      map.addLayer({
        id: FULL_SOURCE,
        type: "line",
        source: FULL_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#d97757", "line-width": 3, "line-opacity": 0.3 },
      });
      map.addSource(PROGRESS_SOURCE, { type: "geojson", data: emptyLine() });
      map.addLayer({
        id: PROGRESS_SOURCE,
        type: "line",
        source: PROGRESS_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#d6381d", "line-width": 5, "line-opacity": 0.97 },
      });
      setMapReady(true);

      // Angkat relief jadi 3D + langit/kabut.
      try {
        if (mode3dRef.current) map.setTerrain({ source: DEM_SOURCE, exaggeration: TERRAIN_EXAGGERATION });
        map.setSky({
          "sky-color": "#0d1b2e",
          "sky-horizon-blend": 0.6,
          "horizon-color": "#e8b98a",
          "horizon-fog-blend": 0.6,
          "fog-color": "#d9c3a5",
          "fog-ground-blend": 0.35,
        });
      } catch {
        /* terrain/sky opsional — animasi tetap jalan dalam mode datar */
      }
    };

    if (map.isStyleLoaded()) setup();
    else {
      map.on("style.load", setup);
      map.on("load", setup); // jaring pengaman bila style.load terlewat
    }

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
      // Jangan pakai isStyleLoaded(): dengan terrain aktif ia bisa tetap false
      // selama DEM dimuat, membuat animasi macet. Cukup cek source siap.
      if (!map || !map.getSource(PROGRESS_SOURCE)) return;

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

  /** Overview: seluruh jalur terframe (miring di 3D, tegak lurus di 2D). */
  const applyOverview = useCallback(
    (animated: boolean) => {
      const map = mapRef.current;
      if (!map) return;
      const g = geoms[activeIdxRef.current];
      const bounds = g.coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(g.coords[0], g.coords[0])
      );
      followActiveRef.current = false;
      map.fitBounds(bounds, {
        padding: 50,
        pitch: mode3dRef.current ? OVERVIEW_PITCH_3D : 0,
        bearing: 0,
        duration: animated ? 900 : 0,
      });
    },
    [geoms]
  );

  /** Kamera flyby: lerp mulus mengikuti pendaki + menghadap arah jalan (3D). */
  const updateFollowCamera = useCallback(
    (f: number) => {
      const map = mapRef.current;
      if (!map) return;
      const g = geoms[activeIdxRef.current];
      const h = hikes[activeIdxRef.current];
      const cur = pointAtFraction(h, g, f).lngLat;
      const ahead = pointAtFraction(h, g, Math.min(1, f + 0.03)).lngLat;
      const targetBearing = bearingDeg(cur, ahead);

      if (!followActiveRef.current) {
        const c = map.getCenter();
        camRef.current = { lng: c.lng, lat: c.lat, bearing: map.getBearing(), pitch: map.getPitch(), zoom: map.getZoom() };
        followActiveRef.current = true;
      }
      const c = camRef.current;
      c.lng += (cur[0] - c.lng) * 0.16;
      c.lat += (cur[1] - c.lat) * 0.16;
      c.bearing = lerpAngle(c.bearing, targetBearing, 0.05);
      c.pitch += (FOLLOW_PITCH - c.pitch) * 0.08;
      c.zoom += (FOLLOW_ZOOM - c.zoom) * 0.08;
      map.jumpTo({ center: [c.lng, c.lat], bearing: c.bearing, pitch: c.pitch, zoom: c.zoom });
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

    applyOverview(true);
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
      // Clamp: setelah tab sempat di-background (rAF pause), jangan biarkan
      // dt raksasa membuat animasi melompat jauh saat kembali.
      const dt = Math.min(lastTs ? ts - lastTs : 0, 100);
      lastTs = ts;

      fRef.current = Math.min(1, fRef.current + (dt / BASE_DURATION_MS) * speedRef.current);
      renderFrame(fRef.current);
      if (mode3dRef.current) updateFollowCamera(fRef.current);

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
          applyOverview(true); // tarik mundur, tampilkan seluruh jalur di relief
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [hikes.length, renderFrame, updateFollowCamera, applyOverview]);

  // Autoplay setelah relief benar-benar termuat (map "idle") supaya animasi
  // tidak berjalan di atas dataran datar sebelum terrain tampak. Fallback timer
  // menjamin tetap main bila idle tak kunjung datang.
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    let done = false;
    const start = () => {
      if (done) return;
      done = true;
      if (reducedMotion) {
        fRef.current = 1;
        renderFrame(1);
        setFinishedAll(true);
      } else {
        setPlaying(true);
      }
    };
    map?.once("idle", start);
    const fallback = setTimeout(start, 4000);
    return () => {
      clearTimeout(fallback);
      map?.off("idle", start);
    };
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

  const toggle3d = () => {
    const next = !mode3d;
    setMode3d(next);
    mode3dRef.current = next;
    const map = mapRef.current;
    if (!map) return;
    map.setTerrain(next ? { source: DEM_SOURCE, exaggeration: TERRAIN_EXAGGERATION } : null);
    followActiveRef.current = false;
    // Saat pindah ke 2D, atau ke 3D sambil tidak memutar → kembali ke overview.
    if (!next || !playingRef.current) applyOverview(true);
  };

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
        <div className="clay-card relative mt-3 overflow-hidden !rounded-2xl p-2">
          <div ref={mapContainerRef} className="h-[45vh] min-h-[280px] w-full overflow-hidden rounded-xl" />
          <button
            type="button"
            onClick={toggle3d}
            title={mode3d ? "Beralih ke tampilan datar (2D)" : "Beralih ke relief 3D"}
            className="clay-chip absolute right-4 top-4 z-10 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200"
          >
            <Boxes size={13} />
            {mode3d ? "3D" : "2D"}
          </button>
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
