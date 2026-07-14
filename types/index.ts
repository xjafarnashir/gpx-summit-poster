export interface TrackPoint {
  lat: number;
  lon: number;
  ele: number;
}

export interface BBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export interface MapAreaMm {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PosterSize {
  widthMm: number;
  heightMm: number;
  dpi: number;
  marginMm: number;
  mapAreaMm: MapAreaMm;
}

export type PosterOrientation = "portrait" | "landscape";

export type PosterPresetId = "A4" | "A3" | "A2" | "A1" | "custom";

/** Satu poster untuk satu pendakian, atau koleksi 2-3 pendakian dalam satu poster. */
export type PosterMode = "single" | "collection";

/**
 * Satu pendakian di dalam poster koleksi. Tiap hike bawa GPX + identitas +
 * statistik + foto pendaki sendiri (lihat mockup: peta di kiri, nama/stat +
 * foto pendaki di kanan).
 */
export interface CollectionHike {
  id: string;
  gpxFileName: string | null;
  gpxData: GpxParseResult | null;
  mountainName: string;
  viaRoute: string;
  date: string;
  /** Ketinggian puncak (mdpl). Diisi otomatis dari GPX, bisa diedit. */
  summitElevationM: number;
  distanceKm: number;
  elevationGainM: number;
  /** Durasi, mis. "03:34:44". */
  movingTime: string;
  /** Lama pendakian, mis. "2 Hari 1 Malam". */
  duration: string;
  /** Warna jalur 3D di peta panel ini. */
  routeColor: string;
  /** Rotasi peta panel ini (derajat, searah jarum jam). 0 = utara di atas. */
  mapRotationDeg: number;
  climberPhoto?: string;
  climberPhotoTransform: PhotoTransform;
}

/** Data poster koleksi: identitas ekspedisi + daftar pendakian. */
export interface CollectionData {
  expeditionTitle: string;
  expeditionDesc: string;
  climberName: string;
  instagram: string;
  tiktok: string;
  /** Link untuk QR code di poster (Strava/Linktree/sosmed, bebas). */
  qrCodeUrl: string;
  /** Preset gradasi latar poster (lihat lib/backgroundThemes). */
  backgroundTheme: string;
  hikes: CollectionHike[];
}

export type MarkerType = "basecamp" | "pos" | "summit";

export interface RouteMarker {
  id: string;
  type: MarkerType;
  label: string;
  trackIndex: number;
  order?: number;
}

/**
 * Pan/zoom of a photo within its fixed poster frame (Instagram-style crop).
 * zoom ≥ 1 (1 = "cover" fit); panX/panY in [-1, 1] (0 = centered). The frame
 * position/size in the poster never changes — only what part of the photo the
 * frame shows.
 */
export interface PhotoTransform {
  zoom: number;
  panX: number;
  panY: number;
}

export interface SummitStats {
  distanceKm: number;
  elevationGainM: number;
  summitElevationM: number;
  movingTime: string;
  avgPace: string;
  temperature: string;
  weather: string;
  headerLabel: string;
  climberName: string;
  mountainName: string;
  date: string;
  viaRoute: string;
  summitPhoto?: string;
  landscapePhoto?: string;
  summitPhotoTransform: PhotoTransform;
  landscapePhotoTransform: PhotoTransform;
  instagram?: string;
  tiktok?: string;
  qrCodeUrl?: string;
}

export type MapTheme =
  | "light"
  | "light_nolabels"
  | "dark"
  | "dark_nolabels"
  | "voyager"
  | "voyager_nolabels"
  | "topo";

export interface ThemeSettings {
  theme: MapTheme;
  tintOpacity: number;
  tintColor: string;
  /** Map/route rotation in degrees (clockwise on the poster). 0 = north-up. */
  mapRotationDeg: number;
  /**
   * Optional photo drawn as the poster backdrop (data URL), blended over the
   * sunset gradient. `backgroundImageOpacity` (0–1) controls how strongly the
   * photo shows: 0 = pure sunset gradient, 1 = fully the photo.
   */
  backgroundImage?: string;
  backgroundImageOpacity: number;
  /** Pan/zoom of the background photo within the poster frame (like PhotoTransform). */
  backgroundImageTransform: PhotoTransform;
  /** Brightness multiplier for the sunset gradient. 1 = normal, >1 = brighter. */
  gradientBrightness: number;
  /** Brightness multiplier for the background photo. 1 = normal, >1 = brighter. */
  backgroundImageBrightness: number;
  /** Preset gradasi latar poster (lihat lib/backgroundThemes). */
  backgroundTheme: string;
}

export interface Export3DSettings {
  lineWidthMm: number;
  extrudeHeightMm: number;
  elevationZ: boolean;
  includeMarkers: boolean;
  registrationMarks: boolean;
}

export interface GpxParseResult {
  points: TrackPoint[];
  distanceKm: number;
  elevationGainM: number;
  minEle: number;
  maxEle: number;
  bbox: BBox;
}

export interface ProjectedPoint {
  x: number;
  y: number;
}
