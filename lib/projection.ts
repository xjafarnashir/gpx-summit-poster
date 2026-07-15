import type { PosterSize, ProjectedPoint, TrackPoint } from "@/types";

/**
 * Shared fit padding: fraction of the map area the route is allowed to fill,
 * leaving surrounding map context around it. MUST be the single source used by
 * projectRoute, mapAreaLatLonBounds (basemap), SVG, and STL so all stay 1:1.
 */
export const ROUTE_PADDING_RATIO = 0.78;

/** Web Mercator sphere radius (meters) — matches EPSG:3857 / CARTO tiles. */
const R = 6378137;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function mercatorX(lonDeg: number): number {
  return R * toRad(lonDeg);
}

function mercatorY(latDeg: number): number {
  const rad = toRad(Math.max(Math.min(latDeg, 85.05112878), -85.05112878));
  return R * Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

function mercatorXToLon(x: number): number {
  return (x / R) * (180 / Math.PI);
}

function mercatorYToLat(y: number): number {
  return (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
}

interface MercatorFit {
  merc: { x: number; y: number }[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  /** Rotation applied to the mercator points (poster-clockwise degrees). */
  rotationDeg: number;
  /** Pivot the rotation was applied around (mercator meters). */
  pivotX: number;
  pivotY: number;
}

/**
 * Shared fit computation: projects trackPoints to Web Mercator meters,
 * optionally rotates them about the route's bbox center (rotationDeg,
 * clockwise on the poster), then derives the single uniform mm-per-meter
 * scale + offset that fits the (rotated) route bbox into `size.mapAreaMm`
 * (centered, with `paddingRatio` breathing room). `projectRoute` (route ->
 * mm) and the basemap fetch helpers derive from this exact same fit, so the
 * fetched basemap always lines up with the projected route.
 */
function computeMercatorFit(
  size: PosterSize,
  trackPoints: TrackPoint[],
  paddingRatio: number,
  rotationDeg = 0
): MercatorFit | null {
  if (trackPoints.length === 0) return null;

  let merc = trackPoints.map((p) => ({ x: mercatorX(p.lon), y: mercatorY(p.lat) }));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const m of merc) {
    if (m.x < minX) minX = m.x;
    if (m.x > maxX) maxX = m.x;
    if (m.y < minY) minY = m.y;
    if (m.y > maxY) maxY = m.y;
  }

  const pivotX = (minX + maxX) / 2;
  const pivotY = (minY + maxY) / 2;

  if (rotationDeg) {
    // Poster-space is y-down, mercator is y-up: a clockwise turn on the
    // poster corresponds to a negative (CW) rotation in mercator space.
    const a = (-rotationDeg * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    merc = merc.map((m) => {
      const dx = m.x - pivotX;
      const dy = m.y - pivotY;
      return { x: pivotX + dx * cos - dy * sin, y: pivotY + dx * sin + dy * cos };
    });
    minX = Infinity;
    maxX = -Infinity;
    minY = Infinity;
    maxY = -Infinity;
    for (const m of merc) {
      if (m.x < minX) minX = m.x;
      if (m.x > maxX) maxX = m.x;
      if (m.y < minY) minY = m.y;
      if (m.y > maxY) maxY = m.y;
    }
  }

  const routeWidthM = Math.max(maxX - minX, 1e-9);
  const routeHeightM = Math.max(maxY - minY, 1e-9);

  const { width: areaWidthMm, height: areaHeightMm } = size.mapAreaMm;

  // Uniform scale: the same mm-per-meter factor for X and Y, chosen so the
  // route's longer relative axis fits within the padded map area.
  const scale = Math.min(
    (areaWidthMm * paddingRatio) / routeWidthM,
    (areaHeightMm * paddingRatio) / routeHeightM
  );

  const scaledWidthMm = routeWidthM * scale;
  const scaledHeightMm = routeHeightM * scale;
  const offsetX = (areaWidthMm - scaledWidthMm) / 2;
  const offsetY = (areaHeightMm - scaledHeightMm) / 2;

  return { merc, minX, maxX, minY, maxY, scale, offsetX, offsetY, rotationDeg, pivotX, pivotY };
}

/**
 * Rotasi otomatis saat GPX di-upload: pilih sudut yang membuat PUNCAK (titik
 * elevasi tertinggi) berada di zona atas peta SAMBIL memaksimalkan ukuran
 * jalur (skala fit terbesar → jalur memanjang mengikuti sumbu panjang kotak
 * peta, tidak pernah kelihatan kecil).
 *
 * Cara kerja: sapu 0–358° (step 2°). Untuk tiap sudut hitung bbox rute yang
 * sudah dirotasi (math rotasi identik dengan computeMercatorFit) →
 * skala fit = min(areaW/rw, areaH/rh), dan posisi relatif puncak dari atas
 * (0 = paling atas). Kandidat valid = puncak di 35% teratas; dari kandidat
 * valid ambil skala terbesar. Kalau tidak ada yang valid (puncak di tengah
 * hull rute), pakai sudut yang menempatkan puncak setinggi mungkin.
 */
export function autoRotationDeg(size: PosterSize, trackPoints: TrackPoint[]): number {
  if (trackPoints.length < 2) return 0;

  const merc = trackPoints.map((p) => ({ x: mercatorX(p.lon), y: mercatorY(p.lat) }));

  // Puncak = titik elevasi maksimum (bukan titik terakhir — track bisa PP).
  let si = 0;
  for (let i = 1; i < trackPoints.length; i++) {
    if (trackPoints[i].ele > trackPoints[si].ele) si = i;
  }

  const { width: areaW, height: areaH } = size.mapAreaMm;
  const TOP_ZONE = 0.35;

  let bestDeg = 0;
  let bestScale = -1;
  let fallbackDeg = 0;
  let fallbackT = 2;

  for (let deg = 0; deg < 360; deg += 2) {
    // Sama dengan computeMercatorFit: derajat searah jarum jam di poster =
    // -deg di ruang mercator (y-up). Pivot tak memengaruhi ukuran bbox
    // maupun posisi relatif, jadi rotasi di sekitar origin saja.
    const a = (-deg * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sy = 0;
    for (let i = 0; i < merc.length; i++) {
      const m = merc[i];
      const x = m.x * cos - m.y * sin;
      const y = m.x * sin + m.y * cos;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (i === si) sy = y;
    }

    const rw = Math.max(maxX - minX, 1e-9);
    const rh = Math.max(maxY - minY, 1e-9);
    const scale = Math.min(areaW / rw, areaH / rh);
    // Poster y-down: atas poster = mercator-y terbesar → t=0 berarti puncak
    // persis di tepi atas bbox rute.
    const t = (maxY - sy) / rh;

    if (t <= TOP_ZONE && scale > bestScale) {
      bestScale = scale;
      bestDeg = deg;
    }
    if (t < fallbackT) {
      fallbackT = t;
      fallbackDeg = deg;
    }
  }

  const deg = bestScale > 0 ? bestDeg : fallbackDeg;
  // Slider rotasi di UI memakai rentang -180..180 — normalisasi ke sana.
  return deg > 180 ? deg - 360 : deg;
}

export interface ProjectionBBoxMm {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ProjectionResult {
  /** Route points in mm, relative to the map area's top-left corner (0,0). */
  points: ProjectedPoint[];
  /** Bounding box of the projected route, in the same mm space. */
  bboxMm: ProjectionBBoxMm;
  /** Uniform mm-per-meter scale actually used (same for X and Y — never skewed). */
  scaleMmPerMeter: number;
}

const EMPTY_RESULT: ProjectionResult = {
  points: [],
  bboxMm: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
  scaleMmPerMeter: 0,
};

/**
 * THE single shared projection function. Poster preview, PNG export, SVG
 * export, and STL export must all call this — never re-implement mercator
 * math elsewhere. That's what guarantees the printed poster and the 3D
 * printed route line up 1:1.
 *
 * Points are returned in millimeters, relative to the map area's top-left
 * corner, using one uniform scale for both axes (fit-and-center within
 * mapAreaMm with `paddingRatio` breathing room) so the route is never
 * stretched/skewed on one axis relative to the other.
 */
export function projectRoute(
  size: PosterSize,
  trackPoints: TrackPoint[],
  options?: { paddingRatio?: number; rotationDeg?: number }
): ProjectionResult {
  const paddingRatio = options?.paddingRatio ?? ROUTE_PADDING_RATIO;
  const fit = computeMercatorFit(size, trackPoints, paddingRatio, options?.rotationDeg ?? 0);
  if (!fit) return EMPTY_RESULT;

  const { merc, minX, maxY, scale, offsetX, offsetY } = fit;

  const points: ProjectedPoint[] = merc.map((m) => ({
    x: (m.x - minX) * scale + offsetX,
    // Mercator Y increases northward; mm Y increases downward — flip it.
    y: (maxY - m.y) * scale + offsetY,
  }));

  let bMinX = Infinity;
  let bMaxX = -Infinity;
  let bMinY = Infinity;
  let bMaxY = -Infinity;
  for (const p of points) {
    if (p.x < bMinX) bMinX = p.x;
    if (p.x > bMaxX) bMaxX = p.x;
    if (p.y < bMinY) bMinY = p.y;
    if (p.y > bMaxY) bMaxY = p.y;
  }

  return {
    points,
    bboxMm: { minX: bMinX, minY: bMinY, maxX: bMaxX, maxY: bMaxY, width: bMaxX - bMinX, height: bMaxY - bMinY },
    scaleMmPerMeter: scale,
  };
}

/**
 * Lat/lon bounds of the FULL map area rectangle (not just the route's own
 * bbox), derived from the exact same fit used by `projectRoute`. Feed this
 * to the tile fetcher so the stitched basemap image lines up pixel-for-pixel
 * with the projected route.
 */
export function mapAreaLatLonBounds(
  size: PosterSize,
  trackPoints: TrackPoint[],
  paddingRatio = ROUTE_PADDING_RATIO
): { west: number; east: number; north: number; south: number } | null {
  const fit = computeMercatorFit(size, trackPoints, paddingRatio);
  if (!fit) return null;

  const { width: areaWidthMm, height: areaHeightMm } = size.mapAreaMm;
  const mercXAtMm = (mmX: number) => fit.minX + (mmX - fit.offsetX) / fit.scale;
  const mercYAtMm = (mmY: number) => fit.maxY - (mmY - fit.offsetY) / fit.scale;

  return {
    west: mercatorXToLon(mercXAtMm(0)),
    east: mercatorXToLon(mercXAtMm(areaWidthMm)),
    north: mercatorYToLat(mercYAtMm(0)),
    south: mercatorYToLat(mercYAtMm(areaHeightMm)),
  };
}

/**
 * Basemap fetch geometry for a ROTATED map. Returns the north-up square that
 * covers the map box at any rotation (side = the box's diagonal), centered on
 * the box's true geographic center, plus `sideMm` for sizing the fetched
 * image. The renderer draws this square rotated by `rotationDeg` around the
 * box center (clipped to the box) so the basemap lines up with the rotated
 * route from `projectRoute`.
 */
export function mapAreaRotatedBasemap(
  size: PosterSize,
  trackPoints: TrackPoint[],
  rotationDeg: number,
  paddingRatio = ROUTE_PADDING_RATIO
): { west: number; east: number; north: number; south: number; sideMm: number } | null {
  const fit = computeMercatorFit(size, trackPoints, paddingRatio, rotationDeg);
  if (!fit) return null;

  const { width: w, height: h } = size.mapAreaMm;
  // Center of the map box in ROTATED mercator space…
  const qx = fit.minX + (w / 2 - fit.offsetX) / fit.scale;
  const qy = fit.maxY - (h / 2 - fit.offsetY) / fit.scale;
  // …inverse-rotated about the pivot to get the true geographic center.
  const a = (rotationDeg * Math.PI) / 180; // inverse of the fit's -rotationDeg
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = qx - fit.pivotX;
  const dy = qy - fit.pivotY;
  const cxGeo = fit.pivotX + dx * cos - dy * sin;
  const cyGeo = fit.pivotY + dx * sin + dy * cos;

  const sideMm = Math.hypot(w, h);
  const halfM = sideMm / 2 / fit.scale;
  return {
    west: mercatorXToLon(cxGeo - halfM),
    east: mercatorXToLon(cxGeo + halfM),
    north: mercatorYToLat(cyGeo + halfM),
    south: mercatorYToLat(cyGeo - halfM),
    sideMm,
  };
}

/** Converts a point in map-area-relative mm to poster-relative mm. */
export function toPosterMm(p: ProjectedPoint, size: PosterSize): ProjectedPoint {
  return { x: size.mapAreaMm.x + p.x, y: size.mapAreaMm.y + p.y };
}

export function mmToPx(mm: number, dpi: number): number {
  return (mm * dpi) / 25.4;
}

export function pxToMm(px: number, dpi: number): number {
  return (px * 25.4) / dpi;
}

/**
 * Vertical layout of the poster as fractions of poster height, matching the
 * reference "sunset" design: header band on top, framed map box, elevation
 * profile, then title/subtitle/stats at the bottom. Shared by computePosterSize
 * and the renderer so the visual map box === mapAreaMm (1:1 registration).
 */
export const POSTER_LAYOUT = {
  headerBandFrac: 0.05, // gap below top margin for "RUTE PENDAKIAN" header
  mapHeightFrac: 0.42, // height of the map box
} as const;

/**
 * Landscape layout: the map is a tall box filling the LEFT column, with the
 * title / stats / photos flowing down the RIGHT column (magazine-style, per the
 * landscape reference). `mapWidthFrac` is the fraction of the inner width the
 * left map column takes; `colGapFrac` is the gutter between the two columns.
 * Shared by computePosterSize and the landscape renderer so the map box the
 * route projects into === the map box drawn on screen (1:1 registration).
 */
export const LANDSCAPE_LAYOUT = {
  mapWidthFrac: 0.44,
  colGapFrac: 0.028,
  mapHeightFrac: 0.82, // map fills this fraction of the left column; the rest is the elevation strip
  elevGapFrac: 0.03, // vertical gap (fraction of content height) between map and elevation strip
} as const;

/** True when the poster is wider than it is tall (landscape orientation). */
export function isLandscapeSize(size: { widthMm: number; heightMm: number }): boolean {
  return size.widthMm > size.heightMm;
}

/**
 * Right column geometry (mm) for the landscape layout — the region that holds
 * the title, stats and photos next to the left map column. Derived from the
 * same LANDSCAPE_LAYOUT fractions computePosterSize uses for the map box, so
 * the two columns always tile the inner width without overlap.
 */
export function landscapeRightColumn(size: PosterSize): { x: number; width: number; gap: number } {
  const innerWidth = Math.max(size.widthMm - size.marginMm * 2, 1);
  const gap = innerWidth * LANDSCAPE_LAYOUT.colGapFrac;
  const x = size.mapAreaMm.x + size.mapAreaMm.width + gap;
  const width = Math.max(size.widthMm - size.marginMm - x, 1);
  return { x, width, gap };
}

/**
 * Derives the full PosterSize (including mapAreaMm) from the physical
 * dimensions the user picked in Step 0. mapAreaMm is the framed map box — the
 * single source of truth every renderer/exporter reads and the exact region the
 * 3D-print route maps onto 1:1. Portrait posters put the map in an upper band;
 * landscape posters put it in a tall left column (see LANDSCAPE_LAYOUT).
 */
export function computePosterSize(params: {
  widthMm: number;
  heightMm: number;
  dpi: number;
  marginMm: number;
}): PosterSize {
  const { widthMm, heightMm, dpi, marginMm } = params;

  const innerWidth = Math.max(widthMm - marginMm * 2, 1);

  if (isLandscapeSize({ widthMm, heightMm })) {
    const contentH = Math.max(heightMm - marginMm * 2, 1);
    const mapWidth = Math.max(innerWidth * LANDSCAPE_LAYOUT.mapWidthFrac, 1);
    const mapHeight = Math.max(contentH * LANDSCAPE_LAYOUT.mapHeightFrac, 1);
    return {
      widthMm,
      heightMm,
      dpi,
      marginMm,
      mapAreaMm: { x: marginMm, y: marginMm, width: mapWidth, height: mapHeight },
    };
  }

  const mapTop = marginMm + heightMm * POSTER_LAYOUT.headerBandFrac;
  const mapHeight = Math.max(heightMm * POSTER_LAYOUT.mapHeightFrac, 1);

  return {
    widthMm,
    heightMm,
    dpi,
    marginMm,
    mapAreaMm: {
      x: marginMm,
      y: mapTop,
      width: innerWidth,
      height: mapHeight,
    },
  };
}
