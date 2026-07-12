import * as turf from "@turf/turf";
import type { BBox, TrackPoint } from "@/types";

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two points in meters. */
export function haversineMeters(a: TrackPoint, b: TrackPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_M * c;
}

export function computeDistanceKm(points: TrackPoint[]): number {
  let totalM = 0;
  for (let i = 1; i < points.length; i++) {
    totalM += haversineMeters(points[i - 1], points[i]);
  }
  return totalM / 1000;
}

/** Sum of positive elevation deltas (simple, no smoothing). */
export function computeElevationGain(points: TrackPoint[]): number {
  let gain = 0;
  for (let i = 1; i < points.length; i++) {
    const delta = points[i].ele - points[i - 1].ele;
    if (delta > 0) gain += delta;
  }
  return gain;
}

export function computeBBox(points: TrackPoint[]): BBox {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, maxLat, minLon, maxLon };
}

/**
 * Snaps an arbitrary lat/lon click to the nearest point ON the track line,
 * returning the index of the nearest existing TrackPoint (not an interpolated
 * point), so markers always land exactly on a real vertex of the route.
 */
export function snapToNearestTrackIndex(
  points: TrackPoint[],
  clicked: { lat: number; lon: number }
): number {
  if (points.length === 0) return 0;

  const line = turf.lineString(points.map((p) => [p.lon, p.lat]));
  const clickPoint = turf.point([clicked.lon, clicked.lat]);
  const snapped = turf.nearestPointOnLine(line, clickPoint);
  const snappedIndex = snapped.properties.index ?? 0;

  // nearestPointOnLine gives the index of the segment start; check both
  // endpoints of that segment against the interpolated snap point to pick
  // whichever real vertex is actually closer.
  const a = points[snappedIndex];
  const b = points[Math.min(snappedIndex + 1, points.length - 1)];
  const distA = haversineMeters(a, clicked as TrackPoint);
  const distB = haversineMeters(b, clicked as TrackPoint);
  return distA <= distB ? snappedIndex : Math.min(snappedIndex + 1, points.length - 1);
}
