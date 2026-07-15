import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import type { Export3DSettings, PosterSize, RouteMarker, TrackPoint } from "@/types";
import { buildRouteCenterline, centerlineElevations, markerPinsMm } from "@/lib/routeRibbon";

export interface StlExportResult {
  stl: ArrayBuffer;
  bboxMm: { width: number; height: number };
  mapAreaMm: { width: number; height: number };
}

/** Amplitude (mm) of the topographic Z-displacement when elevationZ is ON. */
const ELEVATION_AMPLITUDE_MM = 15;
const MARKER_PIN_RADIUS_MM = 2.2;
const JOINT_SEGMENTS = 16;

/**
 * Generates a solid STL of the route ribbon at 1 unit = 1 mm.
 *
 * The ribbon is built as a union of WATERTIGHT 3D primitives — one box per
 * route segment plus a cylinder at every vertex (rounded joints/caps). Each
 * primitive is individually closed and manifold; where they overlap, the
 * slicer unions them at slice time. This is deliberately NOT an extrude of the
 * 2D union outline: on routes that pass close to themselves, that outline
 * self-touches, and extruding a self-touching polygon yields NON-MANIFOLD
 * edges — the classic "needs repair in Blender/Bambu Studio" defect. Overlapping
 * closed primitives avoid that entirely while keeping the exact 1:1 footprint
 * (same centerline + line width as the SVG/poster).
 */
export function exportRouteStl(
  size: PosterSize,
  trackPoints: TrackPoint[],
  markers: RouteMarker[],
  settings: Export3DSettings,
  rotationDeg = 0
): StlExportResult {
  const ribbon = buildRouteCenterline(size, trackPoints, settings.lineWidthMm, rotationDeg);
  const bboxMm = ribbon.bboxMm;

  // Poster/SVG coordinates are Y-DOWN (print space); STL viewers/slicers are
  // Y-UP. Flip Y here so the part — printed top-face-up and viewed from above —
  // matches the poster exactly instead of being a vertical mirror of it.
  // Additionally, CENTER the part at the origin so slicers drop it in the
  // middle of the build plate instead of offset at absolute map coordinates.
  // (XY size is untouched: reflection + translation only, never a scale.)
  const cx = (bboxMm.minX + bboxMm.maxX) / 2;
  const cy = (bboxMm.minY + bboxMm.maxY) / 2;
  const X = (x: number) => x - cx;
  const flipY = (y: number) => cy - y; // flip about the ribbon's own center
  const centerline = ribbon.centerline.map((p) => ({ x: X(p.x), y: flipY(p.y) }));

  const group = new THREE.Group();

  const half = Math.max(settings.lineWidthMm / 2, 0.05);
  const depth = settings.extrudeHeightMm;

  // Per-vertex Z offset for the optional topographic mode.
  let zOffset: (i: number) => number = () => 0;
  if (settings.elevationZ && centerline.length > 0) {
    const elevations = centerlineElevations(size, trackPoints);
    const minEle = Math.min(...elevations);
    const range = Math.max(Math.max(...elevations) - minEle, 1);
    zOffset = (i: number) => (((elevations[i] ?? minEle) - minEle) / range) * ELEVATION_AMPLITUDE_MM;
  }

  // A box per segment (oriented along the segment).
  for (let i = 0; i < centerline.length - 1; i++) {
    const a = centerline[i];
    const b = centerline[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-4) continue;
    const angle = Math.atan2(dy, dx);
    const box = new THREE.BoxGeometry(len, settings.lineWidthMm, depth);
    box.rotateZ(angle);
    const zc = (zOffset(i) + zOffset(i + 1)) / 2 + depth / 2;
    box.translate((a.x + b.x) / 2, (a.y + b.y) / 2, zc);
    group.add(new THREE.Mesh(box));
  }

  // A cylinder at every vertex — rounds the joints and fills segment gaps.
  for (let i = 0; i < centerline.length; i++) {
    const p = centerline[i];
    const cyl = new THREE.CylinderGeometry(half, half, depth, JOINT_SEGMENTS);
    cyl.rotateX(Math.PI / 2); // align cylinder axis to +Z
    cyl.translate(p.x, p.y, zOffset(i) + depth / 2);
    group.add(new THREE.Mesh(cyl));
  }

  // Optional marker pins (small cylinders standing on the ribbon).
  if (settings.includeMarkers) {
    for (const pin of markerPinsMm(size, trackPoints, markers, rotationDeg)) {
      const r = pin.type === "pos" ? MARKER_PIN_RADIUS_MM * 0.7 : MARKER_PIN_RADIUS_MM;
      const h = settings.extrudeHeightMm * 2.2;
      const cyl = new THREE.CylinderGeometry(r, r, h, 24);
      cyl.rotateX(Math.PI / 2); // align cylinder axis to +Z
      cyl.translate(X(pin.x), flipY(pin.y), h / 2);
      group.add(new THREE.Mesh(cyl));
    }
  }

  // NOTE: registration pins are deliberately NOT added to the STL. Pins at the
  // two map corners would blow the print footprint up to nearly the whole map
  // area (e.g. ~161×209 mm on A3) and overflow most build plates. Alignment
  // when gluing uses the poster's printed route line itself (the STL ribbon
  // traces it exactly); the cross-hairs remain on the poster + SVG only.

  const exporter = new STLExporter();
  const result = exporter.parse(group, { binary: true }) as unknown as DataView | ArrayBuffer;
  // three's binary STLExporter returns a DataView; normalize to ArrayBuffer.
  const stl = result instanceof ArrayBuffer ? result : (result as DataView).buffer as ArrayBuffer;

  return {
    stl,
    bboxMm: { width: bboxMm.width, height: bboxMm.height },
    mapAreaMm: { width: size.mapAreaMm.width, height: size.mapAreaMm.height },
  };
}

export function downloadArrayBuffer(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "model/stl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
