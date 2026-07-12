import type { CollectionData, CollectionHike, MapAreaMm, PosterSize } from "@/types";
import { mapAreaLatLonBounds, mapAreaRotatedBasemap, projectRoute, toPosterMm } from "@/lib/projection";
import { fetchStitchedBasemap } from "@/lib/tileFetcher";
import { computeImageRect } from "@/lib/photoTransform";
import { DEFAULT_PHOTO_TRANSFORM } from "@/lib/photoTransform";
import { generateQrDataUrl } from "@/lib/qr";

/* ============================================================================
 * COLLECTION POSTER RENDERER
 * Poster "ekspedisi": 2-3 blok gunung berdampingan (peta + jalur 3D di kiri,
 * nama/stat + foto pendaki di kanan), lalu blok ekspedisi di bawah (judul,
 * daftar gunung, nama/tanggal, total gabungan, deskripsi). Berbagi palet sunset
 * dengan renderer 1-pendakian.
 * ========================================================================== */

const CREAM = "#fbf5ea";
const CREAM_SOFT = "rgba(251,245,234,0.82)";
const CREAM_MUTED = "rgba(251,245,234,0.6)";
const CREAM_FAINT = "rgba(251,245,234,0.3)";
const GOLD = "#ffcf8a";
const SANS = '"Arial Narrow", "Arial", sans-serif';
const MONO = '"Courier New", ui-monospace, monospace';

const BG_STOPS: [number, string][] = [
  [0.0, "#181433"],
  [0.4, "#241d45"],
  [0.7, "#4a3346"],
  [0.88, "#8a4f26"],
  [1.0, "#b0692a"],
];

const MAP_THEME = "topo" as const;

export interface RenderCollectionParams {
  posterSize: PosterSize;
  collection: CollectionData;
  pxPerMm: number;
}

export interface CollectionBlockGeom {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  /** Padding internal kartu (mm). */
  pad: number;
  /** Rect peta blok ini (mm, koordinat poster). SATU-SATUNYA sumber geometri
   *  peta per blok — dipakai renderer PNG dan export STL/SVG agar 1:1. */
  mapRect: MapAreaMm;
  /** Kolom kanan (teks + foto), sejajar vertikal dengan peta. */
  rightRect: MapAreaMm;
}

/** Geometri blok-blok gunung. Renderer & panel export 3D membaca dari sini. */
export function collectionLayout(
  posterSize: PosterSize,
  hikeCount: number
): { blocks: CollectionBlockGeom[]; blocksBottom: number } {
  const { widthMm: W, heightMm: H, marginMm: m } = posterSize;
  const n = Math.max(Math.min(hikeCount, 3), 1);
  const innerW = W - m * 2;
  const contentH = H - m * 2;
  const blockGap = innerW * 0.035;
  const blockW = (innerW - blockGap * (n - 1)) / n;
  const blocksTop = m + contentH * 0.015;
  const blocksBottom = m + contentH * 0.63;
  const blockH = blocksBottom - blocksTop;

  const blocks: CollectionBlockGeom[] = [];
  for (let i = 0; i < n; i++) {
    const bx = m + i * (blockW + blockGap);
    // Kartu ber-padding: peta & kolom kanan duduk DI DALAM panel, sehingga
    // tiap gunung terbaca sebagai satu unit (bukan kolom-kolom lepas).
    const pad = blockW * 0.05;
    const innerX = bx + pad;
    const innerYTop = blocksTop + pad;
    const innerH = blockH - pad * 2;
    const usableW = blockW - pad * 2;
    const mapW = usableW * 0.47;
    const colGap = usableW * 0.07;
    blocks.push({
      bx,
      by: blocksTop,
      bw: blockW,
      bh: blockH,
      pad,
      mapRect: { x: innerX, y: innerYTop, width: mapW, height: innerH },
      rightRect: {
        x: innerX + mapW + colGap,
        y: innerYTop,
        width: usableW - mapW - colGap,
        height: innerH,
      },
    });
  }
  return { blocks, blocksBottom };
}

/** PosterSize sintetis untuk satu blok — mapAreaMm = rect peta blok itu. */
export function collectionBlockSize(posterSize: PosterSize, hikeCount: number, index: number): PosterSize {
  const { blocks } = collectionLayout(posterSize, hikeCount);
  const geom = blocks[Math.max(0, Math.min(index, blocks.length - 1))];
  return { ...posterSize, mapAreaMm: geom.mapRect };
}

/** Fraksi tinggi blok tempat foto pendaki dimulai (dasar foto = dasar peta). */
const PHOTO_TOP_FRAC = 0.52;

/**
 * Rasio (w/h) frame foto pendaki di blok — untuk cropper di editor supaya
 * crop di layar = crop di poster (WYSIWYG). Kolom kanan = 50% lebar blok
 * (peta 46% + gap 4%), foto mengisi dari PHOTO_TOP_FRAC sampai dasar blok.
 */
export function collectionPhotoAspect(posterSize: PosterSize, hikeCount: number): number {
  const { blocks } = collectionLayout(posterSize, hikeCount);
  const g = blocks[0];
  const photoH = g.rightRect.height * (1 - PHOTO_TOP_FRAC);
  return g.rightRect.width / photoH;
}

/* ---------- small helpers (self-contained; mirror exportPng.ts) ---------- */

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function setTextShadow(ctx: CanvasRenderingContext2D, blurPx: number, dy = 0, alpha = 0.5) {
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blurPx;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = dy;
}

function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  try {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  } catch {
    /* ignore */
  }
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal load gambar."));
    img.src = url;
  });
}

/* Ikon hiker custom: orang condong ke depan, ransel di punggung, memegang
 * tongkat trekking. Silhouette terisi (bukan garis tipis) supaya kebaca jelas
 * di ukuran kecil. Dibangun dari primitif → tidak mungkin path rusak. */
const hikerCache = new Map<string, HTMLImageElement>();
function hikerIconImage(color: string, size = 64): Promise<HTMLImageElement> {
  const key = `${color}-${size}`;
  const cached = hikerCache.get(key);
  if (cached) return Promise.resolve(cached);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}">` +
    `<g fill="${color}">` +
    `<circle cx="11.4" cy="3.9" r="2.05"/>` +
    `<rect x="6.4" y="6.2" width="3.9" height="5.9" rx="1.7" transform="rotate(9 8.35 9.15)"/>` +
    `<rect x="9.5" y="5.8" width="3.2" height="7.1" rx="1.6" transform="rotate(11 11.1 9.35)"/>` +
    `<rect x="8.2" y="12.0" width="2.3" height="6.6" rx="1.15" transform="rotate(24 9.35 15.3)"/>` +
    `<rect x="11.3" y="12.2" width="2.3" height="6.9" rx="1.15" transform="rotate(-13 12.45 15.65)"/>` +
    `<rect x="10.7" y="6.5" width="4.9" height="2.0" rx="1.0" transform="rotate(24 13.15 7.5)"/>` +
    `</g>` +
    `<line x1="15.6" y1="8.7" x2="17.8" y2="20.6" stroke="${color}" stroke-width="1.25" stroke-linecap="round"/>` +
    `</svg>`;
  return loadImageFromUrl(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`).then((img) => {
    hikerCache.set(key, img);
    return img;
  });
}

/** Mixes a hex color toward white by `amt` (0..1) — used for the route sheen. */
function lighten(hex: string, amt: number): string {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

/**
 * Truncates `text` with an ellipsis so it fits `maxWidthPx` at the CURRENT
 * ctx.font (and letterSpacing). Returns the text unchanged when it already fits.
 */
function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number): string {
  if (ctx.measureText(text).width <= maxWidthPx) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidthPx) t = t.slice(0, -1);
  return t + "…";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidthPx: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${line} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidthPx) line = test;
    else {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) break;
    }
  }
  lines.push(line);
  return lines.slice(0, maxLines);
}

/* ------------------------------- renderer -------------------------------- */

export async function renderCollectionPoster(params: RenderCollectionParams): Promise<HTMLCanvasElement> {
  const { posterSize, collection, pxPerMm } = params;
  const { widthMm: W, heightMm: H, marginMm: m } = posterSize;
  const mm = (v: number) => v * pxPerMm;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(mm(W));
  canvas.height = Math.round(mm(H));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context tidak tersedia.");

  // 1. Background gradient.
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  for (const [s, c] of BG_STOPS) bg.addColorStop(s, c);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Frame + corner brackets.
  drawFrame(ctx, posterSize, mm);

  // 3. Blocks region geometry (shared with the STL/SVG export — see collectionLayout).
  const hikes = collection.hikes.slice(0, 3);
  const contentH = H - m * 2;
  const { blocks, blocksBottom } = collectionLayout(posterSize, hikes.length);

  // Pre-calculate uniform mountain name font size so none get truncated
  let minNameSize = H;
  ctx.save();
  for (let i = 0; i < hikes.length; i++) {
    const g = blocks[i];
    const rightW = g.rightRect.width;
    const colW = mm(rightW);
    const rh = g.rightRect.height;
    const name = (hikes[i].mountainName || "GUNUNG").toUpperCase();

    let nameSize = rh * 0.11;
    ctx.font = `800 ${mm(nameSize)}px ${SANS}`;
    while (ctx.measureText(name).width > colW && nameSize > rh * 0.02) {
      nameSize *= 0.92;
      ctx.font = `800 ${mm(nameSize)}px ${SANS}`;
    }
    if (nameSize < minNameSize) {
      minNameSize = nameSize;
    }
  }
  ctx.restore();

  for (let i = 0; i < hikes.length; i++) {
    const g = blocks[i];
    await drawHikeBlock(ctx, posterSize, hikes[i], g, mm, minNameSize);
  }

  // 4. Expedition block.
  await drawExpedition(ctx, posterSize, collection, blocksBottom + contentH * 0.03, H - m, mm);

  return canvas;
}

async function drawHikeBlock(
  ctx: CanvasRenderingContext2D,
  posterSize: PosterSize,
  hike: CollectionHike,
  geom: CollectionBlockGeom,
  mm: (v: number) => number,
  sharedNameSize?: number
) {
  const { bx, by, bw, bh, mapRect, rightRect } = geom;
  const rightX = rightRect.x;
  const rightW = rightRect.width;

  // --- Panel kartu: satu latar per gunung supaya blok terbaca sebagai unit ---
  ctx.fillStyle = "rgba(12,9,24,0.32)";
  roundRect(ctx, mm(bx), mm(by), mm(bw), mm(bh), mm(3));
  ctx.fill();
  ctx.strokeStyle = "rgba(251,245,234,0.14)";
  ctx.lineWidth = mm(0.25);
  roundRect(ctx, mm(bx), mm(by), mm(bw), mm(bh), mm(3));
  ctx.stroke();

  // --- Map (left) ---
  const mx = mm(mapRect.x);
  const my = mm(mapRect.y);
  const mw = mm(mapRect.width);
  const mh = mm(mapRect.height);
  const blockSize: PosterSize = { ...posterSize, mapAreaMm: mapRect };

  const rot = hike.mapRotationDeg ?? 0;

  ctx.save();
  roundRect(ctx, mx, my, mw, mh, mm(1.5));
  ctx.clip();
  if (hike.gpxData && hike.gpxData.points.length >= 2) {
    try {
      if (rot) {
        // Rotated map: fetch a north-up square covering the box's diagonal,
        // draw it rotated around the box center (clipped to the box) so the
        // basemap stays aligned with the rotated route.
        const sq = mapAreaRotatedBasemap(blockSize, hike.gpxData.points, rot);
        if (sq) {
          const sidePx = Math.round(mm(sq.sideMm));
          const basemap = await fetchStitchedBasemap(sq, sidePx, sidePx, MAP_THEME);
          ctx.save();
          ctx.translate(mx + mw / 2, my + mh / 2);
          ctx.rotate((rot * Math.PI) / 180);
          ctx.drawImage(basemap, -sidePx / 2, -sidePx / 2, sidePx, sidePx);
          ctx.restore();
        }
      } else {
        const bounds = mapAreaLatLonBounds(blockSize, hike.gpxData.points);
        if (bounds) {
          const basemap = await fetchStitchedBasemap(bounds, Math.round(mw), Math.round(mh), MAP_THEME);
          ctx.drawImage(basemap, mx, my, mw, mh);
        }
      }
    } catch {
      ctx.fillStyle = "#3a3a34";
      ctx.fillRect(mx, my, mw, mh);
    }
  } else {
    ctx.fillStyle = "#33322e";
    ctx.fillRect(mx, my, mw, mh);
  }
  // Tint so the red route pops on the topo map.
  const tint = ctx.createLinearGradient(0, my, 0, my + mh);
  tint.addColorStop(0, "rgba(24,20,51,0.45)");
  tint.addColorStop(1, "rgba(120,70,40,0.42)");
  ctx.fillStyle = tint;
  ctx.fillRect(mx, my, mw, mh);
  ctx.restore();

  // border
  ctx.strokeStyle = "rgba(243,236,223,0.35)";
  ctx.lineWidth = mm(0.25);
  roundRect(ctx, mx, my, mw, mh, mm(1.5));
  ctx.stroke();

  // --- Route (3D raised) + markers ---
  if (hike.gpxData && hike.gpxData.points.length >= 2) {
    const proj = projectRoute(blockSize, hike.gpxData.points, { rotationDeg: rot });
    const pts = proj.points.map((p) => toPosterMm(p, blockSize));

    ctx.save();
    roundRect(ctx, mx, my, mw, mh, mm(1.5));
    ctx.clip();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const trace = () => {
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(mm(p.x), mm(p.y)) : ctx.lineTo(mm(p.x), mm(p.y))));
    };

    const color = hike.routeColor || "#d6381d";
    // drop shadow
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = mm(2.4);
    ctx.save();
    ctx.translate(mm(0.5), mm(0.6));
    trace();
    ctx.stroke();
    ctx.restore();
    // body
    ctx.strokeStyle = color;
    ctx.lineWidth = mm(2.0);
    trace();
    ctx.stroke();
    // sheen
    ctx.strokeStyle = lighten(color, 0.4);
    ctx.lineWidth = mm(0.6);
    trace();
    ctx.stroke();

    // markers: basecamp (start) + summit (end)
    const first = pts[0];
    const last = pts[pts.length - 1];
    drawMarker(ctx, mm(first.x), mm(first.y), "#38bdf8", mm);
    drawMarker(ctx, mm(last.x), mm(last.y), "#ef4444", mm);
    ctx.restore();
  }

  // --- Right column: name + stats + photo ---
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  setLetterSpacing(ctx, 0);

  const colW = mm(rightW);
  const ry = rightRect.y;
  const rh = rightRect.height;

  /* Ritme vertikal kolom kanan (fraksi tinggi kolom, sejajar peta) —
   * eyebrow kecil → NAMA hero → via kecil emas → ANGKA mdpl → 2 baris stat →
   * foto mengisi sisa ruang sampai TEPAT rata dengan dasar peta. */
  const ROW = { eyebrow: 0.05, name: 0.175, via: 0.245, ele: 0.37, stat1: 0.435, stat2: 0.49, photoTop: PHOTO_TOP_FRAC } as const;

  // "PENDAKIAN" eyebrow (clamped to the column)
  ctx.font = `${mm(rh * 0.038)}px ${MONO}`;
  setLetterSpacing(ctx, mm(0.35));
  ctx.fillStyle = CREAM_MUTED;
  ctx.fillText(truncateToWidth(ctx, "PENDAKIAN", colW), mm(rightX), mm(ry + rh * ROW.eyebrow));
  setLetterSpacing(ctx, 0);

  // Mountain name: auto-shrink, then hard-truncate as a last resort so it can
  // never cross into the neighbouring block.
  let name = (hike.mountainName || "GUNUNG").toUpperCase();
  let nameSize = sharedNameSize ?? rh * 0.11;
  if (!sharedNameSize) {
    ctx.font = `800 ${mm(nameSize)}px ${SANS}`;
    while (ctx.measureText(name).width > colW && nameSize > rh * 0.065) {
      nameSize *= 0.92;
      ctx.font = `800 ${mm(nameSize)}px ${SANS}`;
    }
    name = truncateToWidth(ctx, name, colW);
  } else {
    ctx.font = `800 ${mm(nameSize)}px ${SANS}`;
  }
  setTextShadow(ctx, mm(1), mm(0.3), 0.5);
  ctx.fillStyle = CREAM;
  ctx.fillText(name, mm(rightX), mm(ry + rh * ROW.name));
  clearShadow(ctx);

  if (hike.viaRoute) {
    const via = `VIA ${hike.viaRoute.trim().replace(/^via\s+/i, "").toUpperCase()}`;
    let viaSize = rh * 0.04;
    setLetterSpacing(ctx, mm(0.25));
    ctx.font = `${mm(viaSize)}px ${MONO}`;
    while (ctx.measureText(via).width > colW && viaSize > rh * 0.028) {
      viaSize *= 0.93;
      ctx.font = `${mm(viaSize)}px ${MONO}`;
    }
    ctx.fillStyle = GOLD;
    ctx.fillText(truncateToWidth(ctx, via, colW), mm(rightX), mm(ry + rh * ROW.via));
    setLetterSpacing(ctx, 0);
  }

  // Ketinggian (big) on its own line — no side-by-side numbers (they collide in
  // narrow columns). Auto-shrink so "3153 MDPL" always fits the column width.
  const eleStr = `${Math.round(hike.summitElevationM || 0)}`;
  let eleSize = rh * 0.095;
  const measureEleLine = () => {
    ctx.font = `800 ${mm(eleSize)}px ${SANS}`;
    const vw = ctx.measureText(eleStr).width;
    ctx.font = `${mm(eleSize * 0.42)}px ${SANS}`;
    return vw + mm(1.2) + ctx.measureText("MDPL").width;
  };
  while (measureEleLine() > colW && eleSize > rh * 0.06) eleSize *= 0.92;
  ctx.font = `800 ${mm(eleSize)}px ${SANS}`;
  setTextShadow(ctx, mm(0.8), mm(0.2), 0.45);
  ctx.fillStyle = CREAM;
  ctx.fillText(eleStr, mm(rightX), mm(ry + rh * ROW.ele));
  const eleW = ctx.measureText(eleStr).width;
  clearShadow(ctx);
  ctx.font = `600 ${mm(eleSize * 0.4)}px "Arial", sans-serif`;
  ctx.fillStyle = CREAM_SOFT;
  ctx.fillText("MDPL", mm(rightX) + eleW + mm(1.2), mm(ry + rh * ROW.ele));

  // Dua baris statistik pendek — SEMUA input tampil, tidak ada yang dibuang:
  // baris 1: jarak + elevation gain · baris 2: lama pendakian + waktu tempuh.
  const statLine = (parts: string[], rowFrac: number) => {
    const items = parts.filter(Boolean);
    if (items.length === 0) return;
    let size = rh * 0.04;
    const line = items.join("  ·  ");
    ctx.font = `${mm(size)}px ${MONO}`;
    while (ctx.measureText(line).width > colW && size > rh * 0.028) {
      size *= 0.93;
      ctx.font = `${mm(size)}px ${MONO}`;
    }
    ctx.fillStyle = CREAM_SOFT;
    ctx.fillText(truncateToWidth(ctx, line, colW), mm(rightX), mm(ry + rh * rowFrac));
  };
  statLine(
    [`${(hike.distanceKm || 0).toFixed(2)} KM`, hike.elevationGainM ? `+${Math.round(hike.elevationGainM)} M` : ""],
    ROW.stat1
  );
  statLine(
    [hike.duration ? hike.duration.toUpperCase() : "", hike.movingTime && hike.movingTime !== "00:00:00" ? hike.movingTime : ""],
    ROW.stat2
  );

  // Photo (foto pendaki) — fills the rest of the column; its bottom edge sits
  // EXACTLY on the map's bottom edge so the block reads as one unit.
  const photoY = ry + rh * ROW.photoTop;
  const photoH = ry + rh - photoY;
  await drawPhotoBox(ctx, hike, rightX, photoY, rightW, photoH, mm);
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, mm: (v: number) => number) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = mm(0.8);
  ctx.beginPath();
  ctx.arc(x, y, mm(1.6), 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x, y, mm(1.0), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

async function drawPhotoBox(
  ctx: CanvasRenderingContext2D,
  hike: CollectionHike,
  xMm: number,
  yMm: number,
  wMm: number,
  hMm: number,
  mm: (v: number) => number
) {
  const x = mm(xMm);
  const y = mm(yMm);
  const w = mm(wMm);
  const h = mm(hMm);
  const r = mm(1.5);

  if (hike.climberPhoto) {
    try {
      const img = await loadImageFromUrl(hike.climberPhoto);
      const rect = computeImageRect(w, h, img.width, img.height, hike.climberPhotoTransform ?? DEFAULT_PHOTO_TRANSFORM);
      ctx.save();
      roundRect(ctx, x, y, w, h, r);
      ctx.clip();
      ctx.drawImage(img, x + rect.dx, y + rect.dy, rect.dw, rect.dh);
      ctx.restore();
      ctx.strokeStyle = "rgba(243,236,223,0.35)";
      ctx.lineWidth = mm(0.25);
      roundRect(ctx, x, y, w, h, r);
      ctx.stroke();
      return;
    } catch {
      /* fall through to placeholder */
    }
  }

  // placeholder
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(243,236,223,0.25)";
  ctx.lineWidth = mm(0.25);
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.fillStyle = CREAM_MUTED;
  ctx.font = `${mm(hMm * 0.09)}px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("FOTO PENDAKI", x + w / 2, y + h / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

async function drawExpedition(
  ctx: CanvasRenderingContext2D,
  posterSize: PosterSize,
  collection: CollectionData,
  topMm: number,
  bottomMm: number,
  mm: (v: number) => number
) {
  const { widthMm: W, marginMm: m, heightMm: H } = posterSize;
  const cx = W / 2;

  // divider
  ctx.strokeStyle = "rgba(251,245,234,0.22)";
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.moveTo(mm(m), mm(topMm));
  ctx.lineTo(mm(W - m), mm(topMm));
  ctx.stroke();

  // QR code (kanan-atas blok ekspedisi) — link bebas: Strava/Linktree/sosmed.
  const qrSize = Math.min((bottomMm - topMm) * 0.42, H * 0.12);
  let qrDrawn = false;
  if (collection.qrCodeUrl) {
    qrDrawn = await drawQrBox(ctx, collection.qrCodeUrl, W - m - qrSize - 1.5, topMm + 2.5, qrSize, mm);
  }

  const hikes = collection.hikes;
  const title = (collection.expeditionTitle || "EKSPEDISI").toUpperCase();
  const innerW = W - m * 2;
  const innerWpx = mm(innerW);
  // Baris yang sejajar dengan kotak QR ikut menyempit supaya tidak menyentuhnya.
  const besideQrPx = mm(innerW * (qrDrawn ? 0.7 : 0.96));

  /* --- Stack tengah: judul → underline → daftar gunung → nama+tanggal →
   *     sosmed → quote. Semua center-aligned dengan ritme vertikal tetap. --- */
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let titleSize = H * 0.052;
  ctx.font = `800 ${mm(titleSize)}px ${SANS}`;
  while (ctx.measureText(title).width > besideQrPx && titleSize > H * 0.028) {
    titleSize *= 0.94;
    ctx.font = `800 ${mm(titleSize)}px ${SANS}`;
  }
  const titleY = topMm + (bottomMm - topMm) * 0.2;
  setTextShadow(ctx, mm(1.4), mm(0.4), 0.5);
  ctx.fillStyle = CREAM;
  ctx.fillText(title, mm(cx), mm(titleY));
  clearShadow(ctx);

  // gold underline
  ctx.fillStyle = GOLD;
  ctx.fillRect(mm(cx - titleSize * 0.9), mm(titleY + H * 0.01), mm(titleSize * 1.8), mm(0.8));

  // daftar gunung
  const names = hikes.map((h) => (h.mountainName || "GUNUNG").toUpperCase());
  ctx.font = `600 ${mm(H * 0.019)}px ${SANS}`;
  setLetterSpacing(ctx, mm(0.35));
  ctx.fillStyle = CREAM_SOFT;
  ctx.fillText(truncateToWidth(ctx, names.join("    ·    "), besideQrPx), mm(cx), mm(titleY + H * 0.038));
  setLetterSpacing(ctx, 0);

  // nama pendaki — baris sendiri: TEBAL + ikon pendaki emas, di tengah
  if (collection.climberName) {
    const nameSize = H * 0.02;
    const iconMm = nameSize * 1.45;
    ctx.font = `800 ${mm(nameSize)}px "Arial", sans-serif`;
    const nameText = truncateToWidth(ctx, collection.climberName, besideQrPx - mm(iconMm + 2));
    const textW = ctx.measureText(nameText).width;
    const groupW = mm(iconMm) + mm(1.6) + textW;
    const nameBase = titleY + H * 0.066;
    try {
      const icon = await hikerIconImage("#ffcf8a", 72);
      ctx.drawImage(icon, mm(cx) - groupW / 2, mm(nameBase - iconMm * 0.82), mm(iconMm), mm(iconMm));
    } catch {
      /* ikon gagal → nama tetap digambar */
    }
    setTextShadow(ctx, mm(0.8), mm(0.2), 0.45);
    ctx.textAlign = "left";
    ctx.fillStyle = CREAM;
    ctx.fillText(nameText, mm(cx) - groupW / 2 + mm(iconMm) + mm(1.6), mm(nameBase));
    ctx.textAlign = "center";
    clearShadow(ctx);
  }

  // tanggal tiap gunung — baris terpisah di bawah nama pendaki
  const dateBits = hikes
    .filter((h) => h.date)
    .map((h) => `${((h.mountainName || "").split(" ").pop() || "").toUpperCase()} ${h.date.toUpperCase()}`);
  if (dateBits.length > 0) {
    ctx.font = `${mm(H * 0.0125)}px ${MONO}`;
    setLetterSpacing(ctx, mm(0.15));
    ctx.fillStyle = CREAM_MUTED;
    ctx.fillText(truncateToWidth(ctx, dateBits.join("   |   "), besideQrPx), mm(cx), mm(titleY + H * 0.088));
    setLetterSpacing(ctx, 0);
  }

  // sosmed IG / TikTok
  const socials: string[] = [];
  if (collection.instagram) socials.push(`IG ${collection.instagram.startsWith("@") ? collection.instagram : "@" + collection.instagram}`);
  if (collection.tiktok) socials.push(`TT ${collection.tiktok.startsWith("@") ? collection.tiktok : "@" + collection.tiktok}`);
  if (socials.length > 0) {
    ctx.font = `600 ${mm(H * 0.0155)}px "Arial", sans-serif`;
    ctx.fillStyle = CREAM_SOFT;
    ctx.fillText(truncateToWidth(ctx, socials.join("   ·   "), innerWpx), mm(cx), mm(titleY + H * 0.111));
  }

  // quote / deskripsi — italic di tengah, elegan seperti tagline
  if (collection.expeditionDesc) {
    ctx.font = `italic ${mm(H * 0.016)}px ${SANS}`;
    ctx.fillStyle = "rgba(251,245,234,0.72)";
    const quoted = `"${collection.expeditionDesc.trim()}"`;
    const lines = wrapText(ctx, quoted, mm(innerW * 0.68), 2);
    lines.forEach((ln, i) => ctx.fillText(ln, mm(cx), mm(titleY + H * 0.134 + i * H * 0.021)));
  }

  /* --- Baris statistik editorial di dasar: garis tipis + tick emas, lalu
   *     3 kolom rata (label mono emas kecil, angka besar cream) — meniru
   *     stat row poster landscape 1-pendakian. --- */
  const totalEle = hikes.reduce((s, h) => s + (h.summitElevationM || 0), 0);
  const totalDist = hikes.reduce((s, h) => s + (h.distanceKm || 0), 0);
  const totalGain = hikes.reduce((s, h) => s + (h.elevationGainM || 0), 0);
  const cards: { label: string; value: string; unit: string }[] = [
    { label: "TOTAL KETINGGIAN", value: totalEle.toLocaleString("id-ID"), unit: "MDPL" },
    { label: "TOTAL JARAK", value: totalDist.toFixed(2), unit: "KM" },
    { label: "TOTAL ELEV GAIN", value: `+${Math.round(totalGain)}`, unit: "M" },
  ];

  const ruleY = bottomMm - H * 0.062;
  ctx.strokeStyle = "rgba(251,245,234,0.22)";
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.moveTo(mm(m), mm(ruleY));
  ctx.lineTo(mm(W - m), mm(ruleY));
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.fillRect(mm(m), mm(ruleY - 0.5), mm(innerW * 0.12), mm(1));

  const colW = innerW / cards.length;
  const labelSize = H * 0.0125;
  const valueSize = H * 0.028;
  const labelBase = ruleY + H * 0.021;
  const valueBase = labelBase + valueSize + H * 0.006;

  // Tiap kolom di-CENTER dalam sepertiga lebarnya — seimbang kiri-tengah-kanan.
  ctx.textAlign = "left";
  for (let i = 0; i < cards.length; i++) {
    const colCenter = mm(m + colW * (i + 0.5));

    ctx.font = `${mm(labelSize)}px ${MONO}`;
    setLetterSpacing(ctx, mm(0.3));
    ctx.fillStyle = GOLD;
    const lw = ctx.measureText(cards[i].label).width;
    ctx.fillText(cards[i].label, colCenter - lw / 2, mm(labelBase));
    setLetterSpacing(ctx, 0);

    ctx.font = `800 ${mm(valueSize)}px ${SANS}`;
    const vw = ctx.measureText(cards[i].value).width;
    ctx.font = `600 ${mm(valueSize * 0.42)}px "Arial", sans-serif`;
    const uw = ctx.measureText(cards[i].unit).width;
    const groupX = colCenter - (vw + mm(1.4) + uw) / 2;

    ctx.font = `800 ${mm(valueSize)}px ${SANS}`;
    setTextShadow(ctx, mm(0.8), mm(0.2), 0.45);
    ctx.fillStyle = CREAM;
    ctx.fillText(cards[i].value, groupX, mm(valueBase));
    clearShadow(ctx);
    ctx.font = `600 ${mm(valueSize * 0.42)}px "Arial", sans-serif`;
    ctx.fillStyle = CREAM_SOFT;
    ctx.fillText(cards[i].unit, groupX + vw + mm(1.4), mm(valueBase));
  }
}

/** Kotak QR putih membulat; return false bila QR gagal dibuat (link kosong/error). */
async function drawQrBox(
  ctx: CanvasRenderingContext2D,
  url: string,
  xMm: number,
  yMm: number,
  sizeMm: number,
  mm: (v: number) => number
): Promise<boolean> {
  const qrUrl = await generateQrDataUrl(url, 400);
  if (!qrUrl) return false;
  try {
    const img = await loadImageFromUrl(qrUrl);
    const pad = sizeMm * 0.08;
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, mm(xMm), mm(yMm), mm(sizeMm), mm(sizeMm), mm(1.4));
    ctx.fill();
    ctx.drawImage(img, mm(xMm + pad), mm(yMm + pad), mm(sizeMm - pad * 2), mm(sizeMm - pad * 2));
    return true;
  } catch {
    return false;
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, size: PosterSize, mm: (v: number) => number) {
  const { widthMm, heightMm, marginMm } = size;
  const x = mm(marginMm);
  const y = mm(marginMm);
  const w = mm(widthMm - marginMm * 2);
  const h = mm(heightMm - marginMm * 2);

  ctx.strokeStyle = CREAM_FAINT;
  ctx.lineWidth = mm(0.2);
  ctx.strokeRect(x, y, w, h);

  ctx.strokeStyle = CREAM_MUTED;
  ctx.lineWidth = mm(0.45);
  const len = mm(12);
  const corners: [number, number, number, number][] = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  for (const [cxp, cyp, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cxp, cyp + sy * len);
    ctx.lineTo(cxp, cyp);
    ctx.lineTo(cxp + sx * len, cyp);
    ctx.stroke();
  }
}

/** Triggers a browser download of the given canvas as a PNG. */
export function downloadCollectionPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
