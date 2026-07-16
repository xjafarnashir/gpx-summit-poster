import * as turf from "@turf/turf";
import type { GpxParseResult, TrackPoint } from "@/types";
import { computeBBox, computeDistanceKm, computeElevationGain } from "@/lib/geo";
import { parseGpx } from "@/lib/gpxParser";

/* ============================================================================
 * Generator jalur (tanpa file GPX) untuk /editor. Admin menaruh titik di peta;
 * modul ini mengubahnya jadi GpxParseResult yang IDENTIK bentuknya dengan hasil
 * upload GPX — jadi seluruh pipeline poster/STL/preview jalan tanpa perubahan.
 *
 * Dua strategi:
 *   1. buildRouteFollow  — BRouter: ikut jalur pendakian nyata (data OSM) +
 *      ketinggian sudah termasuk di GPX-nya. Bisa gagal bila trail belum ada.
 *   2. buildRouteStraight — sambung titik jadi polyline, dirapatkan, ketinggian
 *      dari Open-Meteo. Selalu berhasil (fallback).
 * ========================================================================== */

export interface Waypoint {
  lat: number;
  lon: number;
}

/** Profil hiking BRouter (mudah diganti bila perlu variasi medan). */
export const BROUTER_PROFILE = "hiking-mountain";

const BROUTER_BASE = "https://brouter.de/brouter";
const OPEN_METEO_ELEV = "https://api.open-meteo.com/v1/elevation";

/** Jarak antar-titik saat merapatkan polyline garis-lurus (meter). */
const DENSIFY_STEP_M = 50;
/** Batas titik yang dirapatkan (jaga performa + kuota elevasi). */
const MAX_DENSE_POINTS = 400;
/** Open-Meteo menerima maksimum 100 koordinat per permintaan. */
const ELEV_BATCH = 100;

/**
 * Rute mengikuti jalur pendakian nyata via BRouter. Semua waypoint dikirim
 * sebagai satu permintaan (start|via...|puncak). Output GPX BRouter memuat
 * <trkpt><ele>, jadi cukup di-parse ulang dengan parseGpx yang sudah ada.
 * Melempar Error bila gagal / kosong supaya pemanggil bisa fallback.
 */
export async function buildRouteFollow(waypoints: Waypoint[]): Promise<GpxParseResult> {
  if (waypoints.length < 2) throw new Error("Butuh minimal 2 titik.");

  const lonlats = waypoints.map((w) => `${w.lon.toFixed(6)},${w.lat.toFixed(6)}`).join("|");
  const url =
    `${BROUTER_BASE}?lonlats=${encodeURIComponent(lonlats)}` +
    `&profile=${encodeURIComponent(BROUTER_PROFILE)}&alternativeidx=0&format=gpx`;

  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Tidak bisa menghubungi layanan jalur (BRouter).");
  }
  if (!res.ok) throw new Error(`Jalur tidak ditemukan (BRouter ${res.status}).`);

  const text = await res.text();
  // BRouter membalas pesan error sebagai teks biasa (bukan GPX) saat gagal.
  if (!text.includes("<trkpt")) throw new Error("Jalur pendakian belum terpetakan di sini.");

  const result = parseGpx(text);
  if (result.points.length < 2) throw new Error("Jalur hasil routing terlalu pendek.");
  return result;
}

/**
 * Rute garis-lurus antar titik, dirapatkan lalu diberi ketinggian dari
 * Open-Meteo. Selalu bisa dipakai (fallback bila trail belum ada di OSM).
 */
export async function buildRouteStraight(waypoints: Waypoint[]): Promise<GpxParseResult> {
  if (waypoints.length < 2) throw new Error("Butuh minimal 2 titik.");

  const line = turf.lineString(waypoints.map((w) => [w.lon, w.lat]));
  const totalKm = turf.length(line, { units: "kilometers" });

  // Jumlah titik menyesuaikan panjang jalur, dibatasi MAX_DENSE_POINTS.
  const desired = Math.max(waypoints.length, Math.round((totalKm * 1000) / DENSIFY_STEP_M) + 1);
  const count = Math.min(desired, MAX_DENSE_POINTS);

  const coords: Waypoint[] = [];
  for (let i = 0; i < count; i++) {
    const at = (totalKm * i) / (count - 1);
    const pt = turf.along(line, at, { units: "kilometers" });
    const [lon, lat] = pt.geometry.coordinates;
    coords.push({ lat, lon });
  }

  const elevations = await fetchElevations(coords);
  const points: TrackPoint[] = coords.map((c, i) => ({ lat: c.lat, lon: c.lon, ele: elevations[i] ?? 0 }));

  return {
    points,
    distanceKm: computeDistanceKm(points),
    elevationGainM: computeElevationGain(points),
    minEle: Math.min(...elevations),
    maxEle: Math.max(...elevations),
    bbox: computeBBox(points),
  };
}

/**
 * Coba ikut jalur (BRouter); jika gagal, otomatis garis-lurus. Mengembalikan
 * hasil + penanda apakah fallback dipakai, supaya UI bisa memberi tahu admin.
 */
export async function buildRoute(
  waypoints: Waypoint[],
  mode: "follow" | "straight"
): Promise<{ result: GpxParseResult; usedFallback: boolean }> {
  if (mode === "straight") {
    return { result: await buildRouteStraight(waypoints), usedFallback: false };
  }
  try {
    return { result: await buildRouteFollow(waypoints), usedFallback: false };
  } catch {
    return { result: await buildRouteStraight(waypoints), usedFallback: true };
  }
}

export interface PlaceResult {
  /** Nama pendek (mis. "Gunung Prau"). */
  name: string;
  /** Alamat lengkap untuk membedakan hasil bernama sama. */
  displayName: string;
  lat: number;
  lon: number;
}

/**
 * Cari lokasi (basecamp, puncak, desa, dll) via Nominatim OSM — CORS terbuka,
 * tanpa API key. Dipakai kotak pencarian di modal Buat Jalur.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (!q) return [];
  const url =
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}` +
    `&format=jsonv2&limit=6&accept-language=id`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Tidak bisa menghubungi layanan pencarian lokasi.");
  }
  if (!res.ok) throw new Error(`Pencarian lokasi gagal (${res.status}).`);
  const json = (await res.json()) as Array<{ name?: string; display_name?: string; lat: string; lon: string }>;
  return json.map((r) => ({
    name: r.name || (r.display_name ?? "").split(",")[0] || "Tanpa nama",
    displayName: r.display_name ?? "",
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }));
}

/** Ketinggian (m) tiap koordinat via Open-Meteo, dipecah per 100 titik. */
export async function fetchElevations(points: Waypoint[]): Promise<number[]> {
  const out: number[] = [];
  for (let i = 0; i < points.length; i += ELEV_BATCH) {
    const batch = points.slice(i, i + ELEV_BATCH);
    const lat = batch.map((p) => p.lat.toFixed(6)).join(",");
    const lon = batch.map((p) => p.lon.toFixed(6)).join(",");
    let res: Response;
    try {
      res = await fetch(`${OPEN_METEO_ELEV}?latitude=${lat}&longitude=${lon}`);
    } catch {
      throw new Error("Gagal mengambil data ketinggian (Open-Meteo).");
    }
    if (!res.ok) throw new Error(`Gagal mengambil data ketinggian (Open-Meteo ${res.status}).`);
    const json = (await res.json()) as { elevation?: number[] };
    if (!Array.isArray(json.elevation)) throw new Error("Respons ketinggian tidak valid.");
    out.push(...json.elevation);
  }
  return out;
}
