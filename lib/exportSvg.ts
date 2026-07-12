import type { Export3DSettings, PosterSize, RouteMarker, TrackPoint } from "@/types";
import { buildRouteRibbon, markerPinsMm, registrationPointsMm, type Pt, type RibbonPolygon } from "@/lib/routeRibbon";

export interface SvgExportResult {
  svg: string;
  /** Route ribbon bounding box in mm (for the 1:1 readout). */
  bboxMm: { width: number; height: number; minX: number; minY: number };
  mapAreaMm: { width: number; height: number };
}

function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

function ringToPath(ring: Pt[]): string {
  if (ring.length === 0) return "";
  const parts = ring.map((p, i) => `${i === 0 ? "M" : "L"}${fmt(p.x)} ${fmt(p.y)}`);
  return parts.join(" ") + " Z";
}

/**
 * Renders every ribbon polygon (outer boundary + holes) as subpaths of a
 * single <path>. polyclip-ts always winds outer rings CCW and holes CW, which
 * is exactly what fill-rule="nonzero" needs to render holes correctly.
 */
function polygonsToPathD(polygons: RibbonPolygon[]): string {
  const parts: string[] = [];
  for (const poly of polygons) {
    parts.push(ringToPath(poly.outer));
    for (const hole of poly.holes) parts.push(ringToPath(hole));
  }
  return parts.join(" ");
}

const MARKER_PIN_RADIUS_MM = 2.2;

/**
 * Builds an SVG containing ONLY the route (as a closed, fillable ribbon polygon
 * — never an open stroke, so slicers can extrude it) at true millimeter scale.
 * width/height/viewBox are in mm and equal the poster's map area, so importing
 * into Bambu Studio yields geometry 1:1 with the printed poster.
 */
export function exportRouteSvg(
  size: PosterSize,
  trackPoints: TrackPoint[],
  markers: RouteMarker[],
  settings: Export3DSettings,
  rotationDeg = 0
): SvgExportResult {
  const { width: mapW, height: mapH } = size.mapAreaMm;
  const { polygons, bboxMm } = buildRouteRibbon(size, trackPoints, settings.lineWidthMm, rotationDeg);

  const shapes: string[] = [];

  // Route ribbon (filled, closed, self-intersection-free — see buildRouteRibbon)
  if (polygons.length > 0) {
    shapes.push(`  <path d="${polygonsToPathD(polygons)}" fill="#000000" fill-rule="nonzero"/>`);
  }

  // Optional marker pins as filled dots (extrude into little cylinders)
  if (settings.includeMarkers) {
    for (const pin of markerPinsMm(size, trackPoints, markers, rotationDeg)) {
      const r = pin.type === "pos" ? MARKER_PIN_RADIUS_MM * 0.7 : MARKER_PIN_RADIUS_MM;
      shapes.push(`  <circle cx="${fmt(pin.x)}" cy="${fmt(pin.y)}" r="${fmt(r)}" fill="#000000"/>`);
    }
  }

  // Optional registration marks (match the poster's PNG cross-hairs)
  if (settings.registrationMarks) {
    for (const p of registrationPointsMm(size)) {
      shapes.push(`  <circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="1" fill="#000000"/>`);
    }
  }

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(mapW)}mm" height="${fmt(mapH)}mm" viewBox="0 0 ${fmt(mapW)} ${fmt(mapH)}">
  <!-- GPX Summit Poster — route ribbon, 1:1 mm. Line width: ${settings.lineWidthMm}mm -->
${shapes.join("\n")}
</svg>
`;

  return {
    svg,
    bboxMm: { width: bboxMm.width, height: bboxMm.height, minX: bboxMm.minX, minY: bboxMm.minY },
    mapAreaMm: { width: mapW, height: mapH },
  };
}

export function downloadTextFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
