import type { StyleSpecification } from "maplibre-gl";
import type { MapTheme } from "@/types";

export const CARTO_ATTRIBUTION = "© OpenStreetMap contributors © CARTO";
const OTM_ATTRIBUTION = "© OpenTopoMap (CC-BY-SA) · © OpenStreetMap";

/** Everything the raster stitcher needs to fetch a basemap for a given theme. */
interface RasterBasemap {
  subdomains: string[];
  url: (s: string, z: number, x: number, y: number, retina: boolean) => string;
  retina: boolean;
  maxZoom: number;
  attribution: string;
}

/** CARTO raster basemap (Positron/Dark Matter/Voyager + their label variants). */
function cartoRaster(path: string): RasterBasemap {
  return {
    subdomains: ["a", "b", "c", "d"],
    url: (s, z, x, y, retina) =>
      `https://${s}.basemaps.cartocdn.com/${path}/${z}/${x}/${y}${retina ? "@2x" : ""}.png`,
    retina: true,
    maxZoom: 18,
    attribution: CARTO_ATTRIBUTION,
  };
}

const RASTER_BASEMAP: Record<MapTheme, RasterBasemap> = {
  light: cartoRaster("light_all"),
  light_nolabels: cartoRaster("light_nolabels"),
  dark: cartoRaster("dark_all"),
  dark_nolabels: cartoRaster("dark_nolabels"),
  voyager: cartoRaster("rastertiles/voyager"),
  voyager_nolabels: cartoRaster("rastertiles/voyager_nolabels"),
  // OpenTopoMap: topographic relief + contour lines. Raster-only, no @2x, z≤17.
  topo: {
    subdomains: ["a", "b", "c"],
    url: (s, z, x, y) => `https://${s}.tile.opentopomap.org/${z}/${x}/${y}.png`,
    retina: false,
    maxZoom: 17,
    attribution: OTM_ATTRIBUTION,
  },
};

/** Basemap credit line for a theme — used on the exported poster. */
export function basemapAttribution(theme: MapTheme): string {
  return RASTER_BASEMAP[theme].attribution;
}

/** OpenTopoMap has no vector GL style, so the editor uses an inline raster style. */
const OTM_GL_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    otm: {
      type: "raster",
      tiles: ["a", "b", "c"].map((s) => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`),
      tileSize: 256,
      maxzoom: 17,
      attribution: OTM_ATTRIBUTION,
    },
  },
  layers: [{ id: "otm", type: "raster", source: "otm" }],
};

/** Map style for the interactive editor: a CARTO GL style URL, or an inline
 *  raster style object for providers (like OpenTopoMap) that have no vector style. */
export const CARTO_STYLE_URL: Record<MapTheme, string | StyleSpecification> = {
  light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  light_nolabels: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
  dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  dark_nolabels: "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
  voyager: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  voyager_nolabels: "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json",
  topo: OTM_GL_STYLE,
};

const LOGICAL_TILE_SIZE = 256;
const MAX_TILES = 200;

function lonToPx(lonDeg: number, z: number, tileSize: number): number {
  return ((lonDeg + 180) / 360) * tileSize * 2 ** z;
}

function latToPx(latDeg: number, z: number, tileSize: number): number {
  const sinLat = Math.sin((latDeg * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI);
  return y * tileSize * 2 ** z;
}

function tileUrl(bm: RasterBasemap, z: number, x: number, y: number, retina: boolean): string {
  const s = bm.subdomains[(x + y) % bm.subdomains.length];
  return bm.url(s, z, x, y, retina);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Gagal memuat tile: ${url}`));
    img.src = url;
  });
}

async function loadImageWithRetry(url: string, retries = 2): Promise<HTMLImageElement> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await loadImage(url);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/** Runs async jobs with a max concurrency, so we don't fire hundreds of
 * simultaneous tile requests at once (some environments silently fail
 * image loads under very high concurrency). */
async function runWithConcurrency<T>(jobs: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await jobs[i]() };
      } catch (e) {
        results[i] = { status: "rejected", reason: e };
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export interface LatLonBounds {
  west: number;
  east: number;
  north: number;
  south: number;
}

/**
 * Fetches & stitches CARTO raster tiles covering `bounds`, then crops to
 * exactly `targetWidthPx` x `targetHeightPx` so the returned canvas maps
 * 1:1 onto the poster's map area — no extra tile margin baked in.
 */
export async function fetchStitchedBasemap(
  bounds: LatLonBounds,
  targetWidthPx: number,
  targetHeightPx: number,
  theme: MapTheme,
  options?: { retina?: boolean }
): Promise<HTMLCanvasElement> {
  const bm = RASTER_BASEMAP[theme];
  const retina = options?.retina ?? bm.retina;
  const pixelTileSize = retina ? LOGICAL_TILE_SIZE * 2 : LOGICAL_TILE_SIZE;

  // Pick the smallest zoom that provides at least the requested resolution.
  let zoom = 0;
  for (let z = 0; z <= bm.maxZoom; z++) {
    const w = lonToPx(bounds.east, z, pixelTileSize) - lonToPx(bounds.west, z, pixelTileSize);
    const h = latToPx(bounds.south, z, pixelTileSize) - latToPx(bounds.north, z, pixelTileSize);
    zoom = z;
    if (w >= targetWidthPx && h >= targetHeightPx) break;
  }

  function pixelBoundsAt(z: number) {
    const pxWest = lonToPx(bounds.west, z, pixelTileSize);
    const pxEast = lonToPx(bounds.east, z, pixelTileSize);
    const pxNorth = latToPx(bounds.north, z, pixelTileSize);
    const pxSouth = latToPx(bounds.south, z, pixelTileSize);
    return {
      pxWest,
      pxEast,
      pxNorth,
      pxSouth,
      minTileX: Math.floor(pxWest / pixelTileSize),
      maxTileX: Math.floor((pxEast - 1) / pixelTileSize),
      minTileY: Math.floor(pxNorth / pixelTileSize),
      maxTileY: Math.floor((pxSouth - 1) / pixelTileSize),
    };
  }

  let px = pixelBoundsAt(zoom);

  // Guard against pathological tile counts (very large posters / high zoom).
  while ((px.maxTileX - px.minTileX + 1) * (px.maxTileY - px.minTileY + 1) > MAX_TILES && zoom > 0) {
    zoom -= 1;
    px = pixelBoundsAt(zoom);
  }

  const { pxWest, pxEast, pxNorth, pxSouth, minTileX, maxTileX, minTileY, maxTileY } = px;

  const worldTiles = 2 ** zoom;
  const tileXs: number[] = [];
  for (let x = minTileX; x <= maxTileX; x++) tileXs.push(((x % worldTiles) + worldTiles) % worldTiles);
  const tileYs: number[] = [];
  for (let y = minTileY; y <= maxTileY; y++) tileYs.push(Math.max(0, Math.min(worldTiles - 1, y)));

  const stitchWidth = tileXs.length * pixelTileSize;
  const stitchHeight = tileYs.length * pixelTileSize;

  const stitchCanvas = document.createElement("canvas");
  stitchCanvas.width = stitchWidth;
  stitchCanvas.height = stitchHeight;
  const stitchCtx = stitchCanvas.getContext("2d");
  if (!stitchCtx) throw new Error("Canvas 2D context tidak tersedia.");

  const jobs: (() => Promise<void>)[] = [];
  for (let iy = 0; iy < tileYs.length; iy++) {
    for (let ix = 0; ix < tileXs.length; ix++) {
      const url = tileUrl(bm, zoom, tileXs[ix], tileYs[iy], retina);
      jobs.push(async () => {
        const img = await loadImageWithRetry(url);
        stitchCtx.drawImage(img, ix * pixelTileSize, iy * pixelTileSize, pixelTileSize, pixelTileSize);
      });
    }
  }
  const results = await runWithConcurrency(jobs, 12);
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
     
    console.warn(`[tileFetcher] ${failed}/${jobs.length} tile gagal dimuat, area tersebut akan tampak kosong.`);
  }

  // Crop from the stitched canvas to exactly the requested bounds/pixels.
  const cropX = pxWest - minTileX * pixelTileSize;
  const cropY = pxNorth - minTileY * pixelTileSize;
  const cropW = pxEast - pxWest;
  const cropH = pxSouth - pxNorth;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = targetWidthPx;
  outCanvas.height = targetHeightPx;
  const outCtx = outCanvas.getContext("2d");
  if (!outCtx) throw new Error("Canvas 2D context tidak tersedia.");

  outCtx.drawImage(stitchCanvas, cropX, cropY, cropW, cropH, 0, 0, targetWidthPx, targetHeightPx);

  return outCanvas;
}
