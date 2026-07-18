import * as turf from "@turf/turf";
import type { CollectionData, GpxParseResult, SummitStats, TrackPoint } from "@/types";

/* ============================================================================
 * SUMMIT REPLAY — QR poster yang saat discan membuka halaman publik
 * beranimasi: marker bergerak dari basecamp ke puncak di peta, profil elevasi
 * berjalan, dan jam tersinkron movingTime. GPX tidak menyimpan timestamp,
 * jadi waktu disintesis kecepatan-konstan (fraksi jarak × total movingTime).
 *
 * Data replay disimpan sisi server dengan id pendek (lihat
 * lib/replayStore.server.ts) supaya QR tetap kecil (~45 karakter) dan mudah
 * discan dari cetakan ±15 mm. Modul ini CLIENT-SAFE: tanpa fs / Netlify.
 * ========================================================================== */

export const REPLAY_VERSION = 1;
/** Target titik per gunung setelah simplifikasi (±7 KB JSON per gunung). */
export const TARGET_REPLAY_POINTS = 250;
/** Batas keras titik per gunung yang diterima server. */
export const MAX_REPLAY_POINTS = 400;
export const MAX_REPLAY_HIKES = 3;
const MAX_TEXT = 120;

/** [lat, lon, ele] — lat/lon 5 desimal (±1 m), ele meter bulat. */
export type ReplayPoint = [number, number, number];

export interface ReplayHike {
  name: string;
  via?: string;
  date?: string;
  /** "HH:MM:SS"; boleh "00:00:00" (jam disembunyikan, animasi tetap jalan). */
  movingTime: string;
  stats: { distanceKm: number; elevationGainM: number; summitElevationM: number };
  points: ReplayPoint[];
}

export type ReplayData =
  | ({ v: number; kind: "single" } & ReplayHike)
  | { v: number; kind: "collection"; title: string; climber?: string; hikes: ReplayHike[] };

export function replayPath(id: string): string {
  return `/landingpage/replay/${id}`;
}

export function isReplayUrl(url: string | undefined): boolean {
  return !!url && url.includes("/landingpage/replay/");
}

/** Id pendek 10-hex (~10^12 ruang) — cukup unik, QR tetap renggang. */
export function generateReplayId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

/**
 * Simplifikasi Douglas–Peucker yang MEMPERTAHANKAN elevasi: turf.simplify
 * tidak pernah menginterpolasi (vertex hasil ⊆ vertex asli), jadi elevasi
 * bisa di-reattach exact lewat map "lon,lat" → ele. Jangan diganti resample
 * turf.along (pola routeBuilder) — itu membuang elevasi.
 */
export function simplifyTrackKeepEle(points: TrackPoint[], target = TARGET_REPLAY_POINTS): ReplayPoint[] {
  const toReplay = (pts: TrackPoint[]): ReplayPoint[] =>
    pts.map((p) => [round5(p.lat), round5(p.lon), Math.round(p.ele)]);

  if (points.length <= target) return toReplay(points);

  const eleByKey = new Map<string, number>();
  for (const p of points) eleByKey.set(`${p.lon},${p.lat}`, p.ele);

  let coords = points.map((p) => [p.lon, p.lat] as [number, number]);
  let tolerance = 0.00002;
  for (let i = 0; i < 14 && coords.length > target; i++) {
    const simplified = turf.simplify(turf.lineString(points.map((p) => [p.lon, p.lat])), {
      tolerance,
      highQuality: false,
    });
    coords = simplified.geometry.coordinates as [number, number][];
    tolerance *= 2;
  }

  return coords.map(([lon, lat]) => [round5(lat), round5(lon), Math.round(eleByKey.get(`${lon},${lat}`) ?? 0)]);
}

const cleanText = (s: unknown): string => (typeof s === "string" ? s.trim().slice(0, MAX_TEXT) : "");

function hikeFrom(
  name: string,
  via: string,
  date: string,
  movingTime: string,
  stats: { distanceKm: number; elevationGainM: number; summitElevationM: number },
  points: TrackPoint[]
): ReplayHike {
  return {
    name: cleanText(name) || "Pendakian",
    via: cleanText(via) || undefined,
    date: cleanText(date) || undefined,
    movingTime: cleanText(movingTime) || "00:00:00",
    stats: {
      distanceKm: Math.round(stats.distanceKm * 100) / 100,
      elevationGainM: Math.round(stats.elevationGainM),
      summitElevationM: Math.round(stats.summitElevationM),
    },
    points: simplifyTrackKeepEle(points),
  };
}

export function buildSingleReplayPayload(stats: SummitStats, gpx: GpxParseResult): ReplayData {
  return {
    v: REPLAY_VERSION,
    kind: "single",
    ...hikeFrom(stats.mountainName, stats.viaRoute, stats.date, stats.movingTime, stats, gpx.points),
  };
}

/** Hike tanpa GPX / <2 titik otomatis dilewati. */
export function buildCollectionReplayPayload(collection: CollectionData): ReplayData {
  const hikes = collection.hikes
    .filter((h) => h.gpxData && h.gpxData.points.length >= 2)
    .slice(0, MAX_REPLAY_HIKES)
    .map((h, i) =>
      hikeFrom(h.mountainName || `Gunung ${i + 1}`, h.viaRoute, h.date, h.movingTime, h, h.gpxData!.points)
    );
  return {
    v: REPLAY_VERSION,
    kind: "collection",
    title: cleanText(collection.expeditionTitle) || "Ekspedisi",
    climber: cleanText(collection.climberName) || undefined,
    hikes,
  };
}

/* ------------------------- validasi (ala parsePricing) --------------------- */

function parseHike(raw: unknown): ReplayHike | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.points) || o.points.length < 2 || o.points.length > MAX_REPLAY_POINTS) return null;
  const points: ReplayPoint[] = [];
  for (const p of o.points) {
    if (!Array.isArray(p) || p.length !== 3) return null;
    const [lat, lon, ele] = p.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(ele)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    points.push([lat, lon, ele]);
  }

  const s = (o.stats ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  return {
    name: cleanText(o.name) || "Pendakian",
    via: cleanText(o.via) || undefined,
    date: cleanText(o.date) || undefined,
    movingTime: cleanText(o.movingTime) || "00:00:00",
    stats: { distanceKm: num(s.distanceKm), elevationGainM: num(s.elevationGainM), summitElevationM: num(s.summitElevationM) },
    points,
  };
}

export function parseReplayData(raw: unknown): ReplayData | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== REPLAY_VERSION) return null;

  if (o.kind === "single") {
    const hike = parseHike(o);
    if (!hike) return null;
    return { v: REPLAY_VERSION, kind: "single", ...hike };
  }

  if (o.kind === "collection") {
    if (!Array.isArray(o.hikes) || o.hikes.length < 1 || o.hikes.length > MAX_REPLAY_HIKES) return null;
    const hikes: ReplayHike[] = [];
    for (const h of o.hikes) {
      const parsed = parseHike(h);
      if (!parsed) return null;
      hikes.push(parsed);
    }
    return {
      v: REPLAY_VERSION,
      kind: "collection",
      title: cleanText(o.title) || "Ekspedisi",
      climber: cleanText(o.climber) || undefined,
      hikes,
    };
  }

  return null;
}
