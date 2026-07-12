import type { GpxParseResult, TrackPoint } from "@/types";
import { computeBBox, computeDistanceKm, computeElevationGain } from "./geo";

/**
 * Parses <trkpt> elements only. <wpt> (POIs like warungs) are intentionally
 * ignored so they never leak onto the route/poster.
 */
export function parseGpx(gpxText: string): GpxParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxText, "application/xml");

  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error("File GPX tidak valid atau rusak.");
  }

  const trkptNodes = Array.from(doc.getElementsByTagName("trkpt"));
  if (trkptNodes.length === 0) {
    throw new Error("Tidak ditemukan titik rute (<trkpt>) di file GPX ini.");
  }

  const points: TrackPoint[] = trkptNodes.map((node) => {
    const lat = parseFloat(node.getAttribute("lat") ?? "0");
    const lon = parseFloat(node.getAttribute("lon") ?? "0");
    const eleNode = node.getElementsByTagName("ele")[0];
    const ele = eleNode ? parseFloat(eleNode.textContent ?? "0") : 0;
    return { lat, lon, ele };
  });

  const distanceKm = computeDistanceKm(points);
  const elevationGainM = computeElevationGain(points);
  const elevations = points.map((p) => p.ele);
  const minEle = Math.min(...elevations);
  const maxEle = Math.max(...elevations);
  const bbox = computeBBox(points);

  return { points, distanceKm, elevationGainM, minEle, maxEle, bbox };
}

export async function parseGpxFile(file: File): Promise<GpxParseResult> {
  const text = await file.text();
  return parseGpx(text);
}
