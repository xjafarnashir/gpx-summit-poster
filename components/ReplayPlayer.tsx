"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import { ArrowUpRight, Boxes, LocateFixed, Mountain, Pause, Play, RotateCcw } from "lucide-react";
import { haversineMeters } from "@/lib/geo";
import { parseHmsToSeconds, secondsToHms } from "@/lib/statFormat";
import type { ReplayData, ReplayHike } from "@/lib/replay";
import type { TrackPoint } from "@/types";

/** Basemap CITRA SATELIT (Esri World Imagery, gratis, CORS *). Dipilih karena:
 *  (1) raster → jauh lebih andal dimuat daripada tile vektor yang kerap kosong,
 *  (2) di-drape ke terrain 3D → gunung/lembah tampak nyata ala FATMAP/Strava. */
const SAT_SOURCE = "sat";
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    [SAT_SOURCE]: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [{ id: SAT_SOURCE, type: "raster", source: SAT_SOURCE }],
};

/* ============================================================================
 * Pemutar Summit Replay (halaman publik hasil scan QR poster).
 *
 * - Chase-cam ala Strava: kamera memandang titik DI DEPAN pendaki di sepanjang
 *   jalur — secara efektif kamera "di belakang" pendaki, medan tanjakan
 *   terbentang ke atas layar.
 * - Semua titik (pendaki, basecamp, puncak) digambar sebagai CIRCLE LAYER,
 *   bukan marker DOM — circle layer menempel di permukaan terrain sehingga
 *   TIDAK PERNAH tenggelam di balik punggungan.
 * - Layout fullscreen (100dvh, tanpa scroll): peta memenuhi layar, info &
 *   kontrol minimalis sebagai overlay + bilah bawah tipis.
 * - Jam = f × movingTime (sintesis kecepatan-konstan; GPX tanpa timestamp).
 * ========================================================================== */

const BASE_DURATION_MS = 35_000; // durasi animasi penuh pada speed 1x
const SPEEDS = [1, 2, 4] as const;
const FULL_SOURCE = "replay-full";
const PROGRESS_SOURCE = "replay-progress";
const HIKER_SOURCE = "replay-hiker";
const ENDPOINT_SOURCE = "replay-endpoints";
const DEM_SOURCE = "replay-dem";

/** DEM Terrarium AWS (gratis, CORS *) untuk relief 3D. */
const TERRARIUM_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_EXAGGERATION = 1.7; // Kembali ke 1.7 agar relief pegunungan tampak nyata ala Strava
const FOLLOW_PITCH = 54; // miring khas flyby, mencegah kamera melihat void ubin di cakrawala
const FOLLOW_ZOOM = 14.1;
const OVERVIEW_PITCH_3D = 52;
/** Kamera memandang titik ~sekian meter DI DEPAN pendaki → view dari belakang;
 *  center selalu di lereng yang akan didaki sehingga kamera tak tenggelam. */
const CHASE_LOOKAT_M = 450;
/** Arah hadap dihitung dari titik sedikit di depan (anti-goyang zigzag). */
const CHASE_BEARING_M = 140;

/** Bearing (derajat) dari a ke b, keduanya [lng, lat]. */
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
  cumDist: number[];
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

const pointTo = (lngLat: [number, number]) =>
  ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: lngLat } }) as GeoJSON.Feature;

const endpointsTo = (start: [number, number], end: [number, number]) =>
  ({
    type: "FeatureCollection",
    features: [
      { type: "Feature", properties: { kind: "start" }, geometry: { type: "Point", coordinates: start } },
      { type: "Feature", properties: { kind: "end" }, geometry: { type: "Point", coordinates: end } },
    ],
  }) as GeoJSON.FeatureCollection;

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
  const [mapError, setMapError] = useState<string | null>(null);
  // Google-Maps-style: begitu user cubit/geser peta, follow berhenti & tombol
  // "tengahkan" muncul untuk kembali mengikuti pendaki.
  const [showRecenter, setShowRecenter] = useState(false);
  const mapReadyRef = useRef(false);
  const satTileLoadedRef = useRef(false);

  const hike = hikes[activeIdx];
  const geom = geoms[activeIdx];

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const elevCanvasRef = useRef<HTMLCanvasElement>(null);
  const elevStaticRef = useRef<HTMLCanvasElement | null>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const eleReadoutRef = useRef<HTMLSpanElement>(null);

  const fRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef<number>(1);
  const activeIdxRef = useRef(0);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mode3dRef = useRef(true);
  const followActiveRef = useRef(false);
  const userPannedRef = useRef(false);
  const camRef = useRef({ lng: 0, lat: 0, bearing: 0, pitch: 0, zoom: 0, ele: 0 });

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
    if (w === 0 || hpx === 0) return;
    cv.width = w;
    cv.height = hpx;

    const g = geoms[activeIdxRef.current];
    const h = hikes[activeIdxRef.current];
    const off = document.createElement("canvas");
    off.width = w;
    off.height = hpx;
    const ctx = off.getContext("2d");
    if (!ctx) return;

    const pad = 5 * dpr;
    const range = Math.max(g.eleMax - g.eleMin, 1);
    const xAt = (i: number) => (g.cumDist[i] / g.totalDist) * w;
    const yAt = (ele: number) => hpx - pad - ((ele - g.eleMin) / range) * (hpx - pad * 2);

    ctx.beginPath();
    ctx.moveTo(0, hpx);
    for (let i = 0; i < h.points.length; i++) ctx.lineTo(xAt(i), yAt(h.points[i][2]));
    ctx.lineTo(w, hpx);
    ctx.closePath();
    ctx.fillStyle = "rgba(217,119,87,0.2)";
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < h.points.length; i++) {
      const x = xAt(i);
      const y = yAt(h.points[i][2]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#d97757";
    ctx.lineWidth = 1.6 * dpr;
    ctx.stroke();

    elevStaticRef.current = off;
  }, [geoms, hikes]);

  /* ------------------------------- peta ---------------------------------- */

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: SATELLITE_STYLE,
      center: geoms[0].coords[0],
      zoom: 12,
      maxPitch: 80,
      attributionControl: { compact: true },
    });
    // Interaksi peta (cubit-zoom, geser, putar) aktif — default MapLibre,
    // ditegaskan agar jelas. Zoom via roda mouse & pinch dua jari.
    map.touchZoomRotate.enable();
    map.touchZoomRotate.enableRotation();
    map.dragPan.enable();
    map.scrollZoom.enable();

    // Gestur user (movestart/zoom/rotate dengan originalEvent) → hentikan
    // auto-follow & tampilkan tombol "tengahkan". jumpTo kita TIDAK membawa
    // originalEvent, jadi tak memicu ini.
    const onUserGesture = (e: { originalEvent?: unknown }) => {
      if (!e.originalEvent) return;
      if (!mode3dRef.current) return;
      userPannedRef.current = true;
      followActiveRef.current = false;
      setShowRecenter(true);
    };
    map.on("movestart", onUserGesture);

    // "style.load" (bukan "load"): tak menunggu tile — animasi selalu bisa mulai.
    let didSetup = false;
    const setup = () => {
      if (didSetup) return;
      didSetup = true;

      // Garis rute — kontras di atas citra satelit gelap.
      map.addSource(FULL_SOURCE, { type: "geojson", data: emptyLine() });
      map.addLayer({
        id: FULL_SOURCE,
        type: "line",
        source: FULL_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 2.5, "line-opacity": 0.4 },
      });
      map.addSource(PROGRESS_SOURCE, { type: "geojson", data: emptyLine() });
      // Casing putih di bawah + garis oranye terang di atas → jalur "menyala".
      map.addLayer({
        id: `${PROGRESS_SOURCE}-casing`,
        type: "line",
        source: PROGRESS_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.9 },
      });
      map.addLayer({
        id: PROGRESS_SOURCE,
        type: "line",
        source: PROGRESS_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ff5a1f", "line-width": 4, "line-opacity": 1 },
      });

      // Titik basecamp/puncak + pendaki sebagai CIRCLE LAYER (menempel di
      // permukaan terrain → tidak pernah tenggelam di balik punggungan).
      map.addSource(ENDPOINT_SOURCE, { type: "geojson", data: endpointsTo(geoms[0].coords[0], geoms[0].coords[0]) });
      map.addLayer({
        id: ENDPOINT_SOURCE,
        type: "circle",
        source: ENDPOINT_SOURCE,
        paint: {
          "circle-radius": 6,
          "circle-color": ["match", ["get", "kind"], "start", "#0ea5e9", "#16a34a"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addSource(HIKER_SOURCE, { type: "geojson", data: pointTo(geoms[0].coords[0]) });
      map.addLayer({
        id: `${HIKER_SOURCE}-glow`,
        type: "circle",
        source: HIKER_SOURCE,
        paint: { "circle-radius": 13, "circle-color": "#ef4444", "circle-opacity": 0.25 },
      });
      map.addLayer({
        id: `${HIKER_SOURCE}-dot`,
        type: "circle",
        source: HIKER_SOURCE,
        paint: {
          "circle-radius": 6,
          "circle-color": "#ef4444",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2.5,
        },
      });

      mapReadyRef.current = true;
      setMapReady(true);
      setMapError(null);

      // Pastikan ukuran canvas sinkron dengan container
      map.resize();



      // PENTING: DEM + terrain baru ditambahkan SETELAH tile satelit dasar
      // benar-benar ter-render di layar. Di MapLibre v5, menyalakan terrain
      // (setTerrain) sebelum tile raster dasar termuat menyebabkan layar
      // HITAM/KOSONG — renderer menunggu DEM drape tapi tak punya apa-apa
      // untuk di-drape. Solusi: tunggu tile satelit termuat dulu, baru
      // tambah DEM source + aktifkan terrain.
      const enableTerrainWhenReady = () => {
        // Cek apakah tile satelit sudah termuat
        const satReady = !!map.getSource(SAT_SOURCE) && map.isSourceLoaded(SAT_SOURCE);
        if (!satReady) return; // belum siap, tunggu event berikutnya
        satTileLoadedRef.current = true;

        // Hentikan listener — cukup sekali
        map.off("sourcedata", onSatLoaded);
        map.off("idle", enableTerrainWhenReady);

        // Baru sekarang tambahkan DEM source (best-effort).
        try {
          map.addSource(DEM_SOURCE, {
            type: "raster-dem",
            tiles: [TERRARIUM_URL],
            encoding: "terrarium",
            tileSize: 256,
            maxzoom: 15,
            attribution: "Terrain: Mapzen/Terrarium · AWS",
          });
        } catch {
          /* DEM opsional */
          return;
        }

        // Tunggu DEM termuat, baru aktifkan terrain.
        const onDemLoaded = (e: maplibregl.MapSourceDataEvent) => {
          if (e.sourceId !== DEM_SOURCE || !e.isSourceLoaded) return;
          map.off("sourcedata", onDemLoaded);
          if (!mode3dRef.current) return;
          try {
            map.setTerrain({ source: DEM_SOURCE, exaggeration: TERRAIN_EXAGGERATION });
          } catch {
            /* terrain opsional — tetap tampil satelit datar */
          }
          // Langit best-effort (hanya setelah terrain aktif).
          try {
            map.setSky({
              "sky-color": "#0d1b2e",
              "sky-horizon-blend": 0.6,
              "horizon-color": "#e8b98a",
              "horizon-fog-blend": 0.6,
              "fog-color": "#d9c3a5",
              "fog-ground-blend": 0.35,
            });
          } catch {
            /* sky opsional */
          }
        };
        map.on("sourcedata", onDemLoaded);
      };

      const onSatLoaded = (e: maplibregl.MapSourceDataEvent) => {
        if (e.sourceId !== SAT_SOURCE || !e.isSourceLoaded) return;
        enableTerrainWhenReady();
      };
      map.on("sourcedata", onSatLoaded);
      // Fallback: jika tile sudah ter-cache, sourcedata mungkin sudah lewat.
      map.on("idle", enableTerrainWhenReady);
    };

    // Jalankan setup SEGERA setelah style siap — via BANYAK pemicu (event +
    // polling) supaya tak bergantung satu event yang bisa terlewat. Tanpa ini,
    // bila style.load/load tak menyala, seluruh konten replay (rute, marker,
    // animasi) tak pernah muncul karena digerbang mapReady.
    const trySetup = () => {
      if (map.isStyleLoaded()) setup();
    };
    map.on("style.load", trySetup);
    map.on("load", trySetup);
    map.on("idle", trySetup);
    trySetup();
    const setupPoll = setInterval(() => {
      if (mapRef.current == null) return;
      trySetup();
      if (mapReadyRef.current) clearInterval(setupPoll);
    }, 200);

    // Surface error tile/peta ke UI (bukan hitam senyap) → mudah didiagnosa.
    const errTimer = setTimeout(() => {
      if (!mapReadyRef.current) setMapError("Peta lambat dimuat — cek koneksi internet.");
    }, 9000);
    map.on("error", (e) => {
      // Hanya tampilkan error KRITIS (sebelum peta siap). Setelah siap, hiccup
      // tile individual diabaikan agar tak memunculkan peringatan palsu.
      if (mapReadyRef.current) return;
      const msg = (e as unknown as { error?: { message?: string } })?.error?.message;
      if (msg) setMapError(msg.slice(0, 140));
    });

    mapRef.current = map;
    
    let hasFitFirstBounds = false;
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
        const container = mapRef.current.getContainer();
        if (container && container.clientWidth > 0 && container.clientHeight > 0 && !hasFitFirstBounds) {
          hasFitFirstBounds = true;
          // Lakukan fitBounds perdana setelah container terukur
          const g = geoms[activeIdxRef.current];
          const bounds = g.coords.reduce(
            (b, c) => b.extend(c),
            new maplibregl.LngLatBounds(g.coords[0], g.coords[0])
          );
          mapRef.current.fitBounds(bounds, {
            padding: 60,
            pitch: mode3dRef.current ? OVERVIEW_PITCH_3D : 0,
            bearing: 0,
            duration: 0,
          });
        }
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      clearInterval(setupPoll);
      clearTimeout(errTimer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Frame animasi pada fraksi f: pendaki, garis progres, elevasi, jam. */
  const renderFrame = useCallback(
    (f: number) => {
      const map = mapRef.current;
      const h = hikes[activeIdxRef.current];
      const g = geoms[activeIdxRef.current];
      if (!map || !map.getSource(PROGRESS_SOURCE)) return;

      const { lngLat, ele, idx } = pointAtFraction(h, g, f);

      (map.getSource(HIKER_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(pointTo(lngLat));
      const progress = g.coords.slice(0, idx + 1).concat([lngLat]);
      (map.getSource(PROGRESS_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(lineTo(progress));

      const cv = elevCanvasRef.current;
      const staticCv = elevStaticRef.current;
      if (cv && staticCv && cv.width > 0) {
        const ctx = cv.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, cv.width, cv.height);
          ctx.drawImage(staticCv, 0, 0);
          const x = f * cv.width;
          const pad = 5 * (cv.width / (cv.clientWidth || 1));
          const range = Math.max(g.eleMax - g.eleMin, 1);
          const y = cv.height - pad - ((ele - g.eleMin) / range) * (cv.height - pad * 2);
          ctx.strokeStyle = "rgba(214,56,29,0.85)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, cv.height);
          ctx.stroke();
          ctx.fillStyle = "#d6381d";
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
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

      // Mencegah error fitBounds jika dimensi container masih 0 (bisa merusak matriks kamera MapLibre)
      const container = map.getContainer();
      if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
        return;
      }

      const g = geoms[activeIdxRef.current];
      const bounds = g.coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(g.coords[0], g.coords[0])
      );
      followActiveRef.current = false;
      map.fitBounds(bounds, {
        padding: 60,
        pitch: mode3dRef.current ? OVERVIEW_PITCH_3D : 0,
        bearing: 0,
        duration: animated ? 900 : 0,
      });
    },
    [geoms]
  );

  /** Chase-cam: kamera memandang titik DI DEPAN pendaki (view dari belakang). */
  const updateFollowCamera = useCallback(
    (f: number) => {
      const map = mapRef.current;
      if (!map) return;
      const g = geoms[activeIdxRef.current];
      const h = hikes[activeIdxRef.current];
      const { lngLat: cur, ele } = pointAtFraction(h, g, f);

      const fBear = Math.min(1, f + CHASE_BEARING_M / g.totalDist);
      const targetBearing = bearingDeg(cur, pointAtFraction(h, g, fBear).lngLat);

      const fLookAt = Math.min(1, f + CHASE_LOOKAT_M / g.totalDist);
      const lookAt = pointAtFraction(h, g, fLookAt).lngLat;

      if (!followActiveRef.current) {
        camRef.current = {
          lng: lookAt[0],
          lat: lookAt[1],
          bearing: map.getBearing(),
          pitch: map.getPitch(),
          zoom: map.getZoom(),
          ele,
        };
        followActiveRef.current = true;
      }
      const c = camRef.current;
      c.lng += (lookAt[0] - c.lng) * 0.12;
      c.lat += (lookAt[1] - c.lat) * 0.12;
      c.bearing = lerpAngle(c.bearing, targetBearing, 0.05);
      c.pitch += (FOLLOW_PITCH - c.pitch) * 0.08;

      // Zoom adaptif: makin tinggi posisi pendaki, sedikit mundur supaya medan
      // lookahead tetap terlihat meski terrain terangkat exaggeration.
      c.ele += (ele - c.ele) * 0.07;
      const climbRatio = Math.max(0, Math.min(1, (c.ele - g.eleMin) / Math.max(g.eleMax - g.eleMin, 1)));
      const targetZoom = FOLLOW_ZOOM - climbRatio * 0.9;
      c.zoom += (targetZoom - c.zoom) * 0.08;

      map.jumpTo({ center: [c.lng, c.lat], bearing: c.bearing, pitch: c.pitch, zoom: c.zoom });
    },
    [geoms, hikes]
  );

  /* --------------------- muat hike aktif ke peta -------------------------- */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    (map.getSource(FULL_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(lineTo(geom.coords));
    (map.getSource(PROGRESS_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(emptyLine());
    (map.getSource(ENDPOINT_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(
      endpointsTo(geom.coords[0], geom.coords[geom.coords.length - 1])
    );
    (map.getSource(HIKER_SOURCE) as maplibregl.GeoJSONSource | undefined)?.setData(pointTo(geom.coords[0]));

    applyOverview(true);
    drawStaticElevation();
    renderFrame(fRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, activeIdx]);

  useEffect(() => {
    const onResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
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
      // Clamp dt: setelah tab di-background, jangan melompat jauh saat kembali.
      const dt = Math.min(lastTs ? ts - lastTs : 0, 100);
      lastTs = ts;

      fRef.current = Math.min(1, fRef.current + (dt / BASE_DURATION_MS) * speedRef.current);
      renderFrame(fRef.current);
      if (mode3dRef.current && !userPannedRef.current) updateFollowCamera(fRef.current);

      if (fRef.current >= 1) {
        setPlaying(false);
        const idx = activeIdxRef.current;
        if (idx < hikes.length - 1) {
          advanceTimerRef.current = setTimeout(() => {
            fRef.current = 0;
            setActiveIdx(idx + 1);
            setPlaying(true);
          }, 1500);
        } else {
          setFinishedAll(true);
          applyOverview(true); // tarik mundur: seluruh jalur di atas relief
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [hikes.length, renderFrame, updateFollowCamera, applyOverview]);

  // Autoplay setelah peta idle (relief termuat) — fallback 4 dtk.
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

  const resumeFollow = () => {
    userPannedRef.current = false;
    followActiveRef.current = false;
    setShowRecenter(false);
    // Bila sedang pause, tengahkan segera; kalau memutar, frame berikut menyusul.
    if (!playingRef.current) updateFollowCamera(fRef.current);
  };

  const switchHike = (idx: number, autoplay: boolean) => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    fRef.current = 0;
    setFinishedAll(false);
    userPannedRef.current = false;
    setShowRecenter(false);
    setActiveIdx(idx);
    setPlaying(autoplay);
  };

  const handlePlayPause = () => {
    if (fRef.current >= 1 && !playing) {
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
    try {
      // Nyalakan terrain hanya bila BOTH sat + DEM sudah termuat (hindari layar hitam).
      const demReady = satTileLoadedRef.current && !!map.getSource(DEM_SOURCE) && map.isSourceLoaded(DEM_SOURCE);
      map.setTerrain(next && demReady ? { source: DEM_SOURCE, exaggeration: TERRAIN_EXAGGERATION } : null);
    } catch {
      /* terrain opsional */
    }
    followActiveRef.current = false;
    userPannedRef.current = false;
    setShowRecenter(false);
    if (!next || !playingRef.current) applyOverview(true);
  };

  /* --------------------------------- UI ----------------------------------- */

  const title = data.kind === "single" ? data.name : data.title;
  const subtitle =
    data.kind === "single"
      ? [data.via ? `via ${data.via}` : null, data.date].filter(Boolean).join(" · ")
      : [data.climber, `${hikes.length} gunung`].filter(Boolean).join(" · ");

  const overlayChip =
    "rounded-full bg-black/45 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* bilah atas tipis: brand + CTA */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 px-3">
        <Link href="/landingpage" className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white">
            <Mountain size={13} />
          </span>
          <span className="truncate text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-50">myKoordinat</span>
        </Link>
        <Link
          href="/landingpage"
          className="clay-chip flex shrink-0 items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-[#9c4a2c] dark:text-[#e59a7c]"
        >
          Pesan postermu
          <ArrowUpRight size={11} />
        </Link>
      </header>

      {/* peta memenuhi sisa layar */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>

        {/* judul overlay */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 max-w-[70%]">
          <div className="w-fit rounded-xl bg-black/45 px-3 py-2 backdrop-blur-sm">
            <p className="font-mono text-[8px] uppercase tracking-[0.25em] text-[#ffcf8a]">Summit Replay</p>
            <h1 className="truncate text-base font-extrabold leading-tight text-white">{title}</h1>
            {subtitle && <p className="truncate text-[10px] text-white/75">{subtitle}</p>}
          </div>
          {/* tab gunung (koleksi) */}
          {hikes.length > 1 && (
            <div className="pointer-events-auto mt-1.5 flex flex-wrap gap-1.5">
              {hikes.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => switchHike(i, true)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-sm transition-colors ${
                    i === activeIdx ? "bg-[#d97757] text-white" : "bg-black/45 text-white/80"
                  }`}
                >
                  {i + 1}. {h.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* toggle 3D + speed di kanan-atas peta */}
        <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1.5">
          <button type="button" onClick={toggle3d} title="Ganti mode tampilan" className={`${overlayChip} flex items-center gap-1`}>
            <Boxes size={11} />
            {mode3d ? "3D" : "2D"}
          </button>
          <button type="button" onClick={cycleSpeed} title="Kecepatan animasi" className={`${overlayChip} font-mono`}>
            {speed}x
          </button>
        </div>

        {/* status: memuat / error peta — jangan biarkan hitam senyap */}
        {!mapReady && !mapError && (
          <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
            <span className="rounded-full bg-black/50 px-4 py-2 text-xs text-white/80 backdrop-blur-sm">
              Memuat peta…
            </span>
          </div>
        )}
        {mapError && (
          <div className="pointer-events-none absolute inset-x-4 bottom-16 z-10 flex justify-center">
            <span className="max-w-full rounded-xl bg-red-900/70 px-3 py-2 text-center text-[11px] text-red-100 backdrop-blur-sm">
              Peta bermasalah: {mapError}
            </span>
          </div>
        )}

        {/* tombol "Tengahkan" ala Google Maps — muncul saat user menggeser peta */}
        {showRecenter && (
          <button
            type="button"
            onClick={resumeFollow}
            title="Tengahkan ke pendaki"
            className="clay-btn absolute bottom-3 right-3 z-10 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#d97757] to-[#b8532f] px-4 py-2 text-xs font-semibold text-white"
          >
            <LocateFixed size={13} />
            Tengahkan
          </button>
        )}
      </div>

      {/* bilah bawah tipis: elevasi + kontrol + statistik */}
      <div className="shrink-0 px-3 pb-2 pt-1.5">
        <div className="relative">
          <canvas ref={elevCanvasRef} className="h-12 w-full" />
          <span className="pointer-events-none absolute right-1 top-0 font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
            <span ref={eleReadoutRef}>{Math.round(geom.eleMin)} mdpl</span>
            {geom.totalSeconds > 0 && (
              <>
                {" · "}
                <span ref={clockRef} className="font-semibold text-[#b8532f] dark:text-[#e59a7c]">
                  00:00:00
                </span>
              </>
            )}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={handlePlayPause}
            title={playing ? "Pause" : finishedAll ? "Putar lagi" : "Putar"}
            className="clay-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#d97757] to-[#b8532f] text-white"
          >
            {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
          </button>
          <button
            type="button"
            onClick={handleRestart}
            title="Ulangi dari awal"
            className="clay-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-600 dark:text-zinc-300"
          >
            <RotateCcw size={13} />
          </button>
          <p className="min-w-0 flex-1 truncate text-right font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
            {hike.stats.summitElevationM.toLocaleString("id-ID")} mdpl · {hike.stats.distanceKm.toFixed(1)} km · +
            {hike.stats.elevationGainM} m{geom.totalSeconds > 0 && ` · ${hike.movingTime}`}
          </p>
        </div>
      </div>
    </div>
  );
}
