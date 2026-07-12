import { union } from "polyclip-ts";
import type { PosterSize, RouteMarker, TrackPoint } from "@/types";
import { projectRoute } from "@/lib/projection";

export interface Pt {
  x: number;
  y: number;
}

/** A single filled region: outer boundary + optional holes (both simple, non-self-intersecting). */
export interface RibbonPolygon {
  outer: Pt[];
  holes: Pt[][];
}

export interface RibbonResult {
  /** One or more disjoint filled polygons that together form the route ribbon
   *  (mm, relative to map area top-left). Built as a boolean UNION of per-segment
   *  rectangles + round joints → a clean, non-self-intersecting 2D outline, used
   *  by the SVG export. (The STL export instead extrudes watertight 3D primitives
   *  from `centerline`, because extruding a self-touching 2D outline would be
   *  non-manifold — see lib/exportStl.ts.) */
  polygons: RibbonPolygon[];
  /** Centerline points (mm), same projection as the poster route. Source of
   *  truth for the STL's box-per-segment + cylinder-per-joint geometry. */
  centerline: Pt[];
  bboxMm: { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number };
}

/** Drops consecutive duplicate/near-duplicate points that would break normals. */
function dedupe(points: Pt[], eps = 1e-4): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > eps) out.push(p);
  }
  return out;
}

type Ring = [number, number][];
type Poly = Ring[];

function segmentRectangle(a: Pt, b: Pt, half: number): Poly {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  const ring: Ring = [
    [a.x + nx, a.y + ny],
    [b.x + nx, b.y + ny],
    [b.x - nx, b.y - ny],
    [a.x - nx, a.y - ny],
  ];
  return [ring];
}

function jointCircle(center: Pt, radius: number, sides = 10): Poly {
  const ring: Ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    ring.push([center.x + Math.cos(a) * radius, center.y + Math.sin(a) * radius]);
  }
  return [ring];
}

/**
 * Builds the route ribbon as the boolean UNION of a rectangle per segment plus
 * a round joint at every vertex (including the two ends, for rounded caps).
 * Unlike a naive per-vertex miter offset, a boolean union can never produce a
 * self-intersecting (bowtie) outline, no matter how sharp a switchback is —
 * that self-intersection was the #1 cause of "needs repair" STL/SVG exports.
 */
function buildRibbonPolygons(centerline: Pt[], lineWidthMm: number): RibbonPolygon[] {
  const half = Math.max(lineWidthMm / 2, 0.05);
  if (centerline.length < 2) return [];

  const shapes: Poly[] = [];
  for (let i = 0; i < centerline.length - 1; i++) {
    shapes.push(segmentRectangle(centerline[i], centerline[i + 1], half));
  }
  for (let i = 0; i < centerline.length; i++) {
    shapes.push(jointCircle(centerline[i], half));
  }

  const merged = union(shapes[0], ...shapes.slice(1));

  return merged.map((poly) => ({
    outer: poly[0].map(([x, y]) => ({ x, y })),
    holes: poly.slice(1).map((ring) => ring.map(([x, y]) => ({ x, y }))),
  }));
}

/**
 * Projects trackPoints and builds the robust ribbon geometry shared by SVG and
 * STL export. Works in planar mm space (NOT geodesic) — our coordinates are
 * already millimeters from `projectRoute`, so a planar union keeps SVG and STL
 * truly 1:1 with the poster.
 */
export function buildRouteRibbon(
  size: PosterSize,
  trackPoints: TrackPoint[],
  lineWidthMm: number,
  rotationDeg = 0
): RibbonResult {
  const proj = projectRoute(size, trackPoints, { rotationDeg });
  const centerline = dedupe(proj.points);

  if (centerline.length < 2) {
    return {
      polygons: [],
      centerline,
      bboxMm: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
    };
  }

  const polygons = buildRibbonPolygons(centerline, lineWidthMm);

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polygons) {
    for (const p of poly.outer) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!Number.isFinite(minX)) {
    minX = minY = maxX = maxY = 0;
  }

  return {
    polygons,
    centerline,
    bboxMm: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}

export interface MarkerPinMm {
  type: RouteMarker["type"];
  x: number;
  y: number;
}

/** Marker positions in the same mm space, for optional pins in SVG/STL. */
export function markerPinsMm(
  size: PosterSize,
  trackPoints: TrackPoint[],
  markers: RouteMarker[],
  rotationDeg = 0
): MarkerPinMm[] {
  const proj = projectRoute(size, trackPoints, { rotationDeg });
  const pins: MarkerPinMm[] = [];
  for (const m of markers) {
    const p = proj.points[m.trackIndex];
    if (p) pins.push({ type: m.type, x: p.x, y: p.y });
  }
  return pins;
}

/** Registration cross-hair positions (mm), matching the poster's PNG marks. */
export function registrationPointsMm(size: PosterSize): Pt[] {
  const { width, height } = size.mapAreaMm;
  return [
    { x: 6, y: 6 },
    { x: width - 6, y: height - 6 },
  ];
}

/** Elevation (m) sampled per centerline vertex, aligned to `centerline` order. */
export function centerlineElevations(size: PosterSize, trackPoints: TrackPoint[]): number[] {
  // projectRoute preserves input order & count; dedupe in buildRouteRibbon may
  // drop some, so re-run the same dedupe logic on paired (point, ele).
  const proj = projectRoute(size, trackPoints);
  const paired = proj.points.map((p, i) => ({ p, ele: trackPoints[i]?.ele ?? 0 }));
  const out: number[] = [];
  let last: Pt | null = null;
  for (const { p, ele } of paired) {
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1e-4) {
      out.push(ele);
      last = p;
    }
  }
  return out;
}
