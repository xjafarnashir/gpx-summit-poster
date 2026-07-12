import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  CollectionData,
  CollectionHike,
  Export3DSettings,
  GpxParseResult,
  PosterMode,
  PosterOrientation,
  PosterPresetId,
  PosterSize,
  RouteMarker,
  SummitStats,
  ThemeSettings,
  TrackPoint,
} from "@/types";
import { computePosterSize } from "./projection";
import { DEFAULT_PHOTO_TRANSFORM } from "./photoTransform";

export const POSTER_PRESETS_MM: Record<Exclude<PosterPresetId, "custom">, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
  A1: { width: 594, height: 841 },
};

export interface SizeSetupState {
  preset: PosterPresetId;
  orientation: PosterOrientation;
  customWidthMm: number;
  customHeightMm: number;
  dpi: number;
  marginMm: number;
}

const DEFAULT_SIZE_SETUP: SizeSetupState = {
  preset: "A3",
  orientation: "portrait",
  customWidthMm: 210,
  customHeightMm: 297,
  dpi: 300,
  marginMm: 15,
};

export const DEFAULT_STATS: SummitStats = {
  distanceKm: 0,
  elevationGainM: 0,
  summitElevationM: 0,
  movingTime: "00:00:00",
  avgPace: "",
  temperature: "",
  weather: "",
  headerLabel: "RUTE PENDAKIAN",
  climberName: "",
  mountainName: "",
  date: "",
  viaRoute: "",
  summitPhotoTransform: DEFAULT_PHOTO_TRANSFORM,
  landscapePhotoTransform: DEFAULT_PHOTO_TRANSFORM,
  instagram: "",
  tiktok: "",
  qrCodeUrl: "",
};

export const DEFAULT_THEME: ThemeSettings = {
  theme: "voyager",
  tintOpacity: 0.25,
  tintColor: "#0f172a",
  mapRotationDeg: 0,
  backgroundImage: undefined,
  backgroundImageOpacity: 0.5,
  backgroundImageTransform: DEFAULT_PHOTO_TRANSFORM,
};

export const DEFAULT_EXPORT_3D: Export3DSettings = {
  lineWidthMm: 2,
  extrudeHeightMm: 1.5,
  elevationZ: false,
  includeMarkers: false,
  registrationMarks: true,
};

export const DEFAULT_ROUTE_COLOR = "#d6381d";

/** Kartu pendakian kosong untuk poster koleksi. */
export function makeEmptyHike(): CollectionHike {
  return {
    id: crypto.randomUUID(),
    gpxFileName: null,
    gpxData: null,
    mountainName: "",
    viaRoute: "",
    date: "",
    summitElevationM: 0,
    distanceKm: 0,
    elevationGainM: 0,
    movingTime: "00:00:00",
    duration: "",
    routeColor: DEFAULT_ROUTE_COLOR,
    mapRotationDeg: 0,
    climberPhotoTransform: DEFAULT_PHOTO_TRANSFORM,
  };
}

export const DEFAULT_COLLECTION: CollectionData = {
  expeditionTitle: "",
  expeditionDesc: "",
  climberName: "",
  instagram: "",
  tiktok: "",
  qrCodeUrl: "",
  hikes: [makeEmptyHike(), makeEmptyHike()],
};

/** Batas jumlah pendakian dalam satu poster koleksi. */
export const MAX_COLLECTION_HIKES = 3;
export const MIN_COLLECTION_HIKES = 2;

function dimsForPreset(preset: PosterPresetId, orientation: PosterOrientation, customW: number, customH: number) {
  const base = preset === "custom" ? { width: customW, height: customH } : POSTER_PRESETS_MM[preset];
  const isPortraitBase = base.height >= base.width;
  const wantPortrait = orientation === "portrait";
  if (isPortraitBase === wantPortrait) return { widthMm: base.width, heightMm: base.height };
  return { widthMm: base.height, heightMm: base.width };
}

export function resolvePosterSize(setup: SizeSetupState): PosterSize {
  const { widthMm, heightMm } = dimsForPreset(setup.preset, setup.orientation, setup.customWidthMm, setup.customHeightMm);
  return computePosterSize({
    widthMm,
    heightMm,
    dpi: setup.dpi,
    marginMm: setup.marginMm,
  });
}

interface AppState {
  sizeSetup: SizeSetupState;
  posterSize: PosterSize;
  gpxFileName: string | null;
  gpxData: GpxParseResult | null;
  markers: RouteMarker[];
  stats: SummitStats;
  theme: ThemeSettings;
  export3d: Export3DSettings;
  posterMode: PosterMode;
  collection: CollectionData;
  hasHydrated: boolean;
  storageWarning: string | null;

  setSizeSetup: (patch: Partial<SizeSetupState>) => void;
  setGpxData: (fileName: string, data: GpxParseResult) => void;
  setMarkers: (markers: RouteMarker[]) => void;
  addMarker: (marker: RouteMarker) => void;
  updateMarker: (id: string, patch: Partial<RouteMarker>) => void;
  removeMarker: (id: string) => void;
  reorderPosMarkers: (orderedIds: string[]) => void;
  setStats: (patch: Partial<SummitStats>) => void;
  setTheme: (patch: Partial<ThemeSettings>) => void;
  setExport3d: (patch: Partial<Export3DSettings>) => void;
  setStorageWarning: (msg: string | null) => void;
  setPosterMode: (mode: PosterMode) => void;
  setCollectionMeta: (
    patch: Partial<Pick<CollectionData, "expeditionTitle" | "expeditionDesc" | "climberName" | "instagram" | "tiktok" | "qrCodeUrl">>
  ) => void;
  addHike: () => void;
  updateHike: (id: string, patch: Partial<CollectionHike>) => void;
  removeHike: (id: string) => void;
  setHikeGpx: (id: string, fileName: string, data: GpxParseResult) => void;
  reset: () => void;
}

function computeInitialPosterSize(): PosterSize {
  return resolvePosterSize(DEFAULT_SIZE_SETUP);
}

const PERSIST_KEY = "gpx-summit-poster-store";

function isQuotaExceeded(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED" || e.code === 22)
  );
}

// Assigned synchronously inside the store creator below (before persist can
// ever invoke storage.setItem), so safeStorage never has to reference the
// useAppStore const before it exists.
let notifyStorageWarning: ((msg: string | null) => void) | null = null;

/**
 * localStorage wrapper used by the persist middleware. Regular photo uploads
 * are compressed client-side (see lib/image.ts) so they should almost never
 * hit the quota — but as a safety net, if a setItem still overflows we retry
 * once with the (biggest) photo fields stripped, rather than letting the
 * QuotaExceededError bubble up and crash whatever triggered the state update.
 */
const safeStorage: StateStorage = {
  getItem: (name) => (typeof window === "undefined" ? null : window.localStorage.getItem(name)),
  removeItem: (name) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(name);
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
      notifyStorageWarning?.(null);
      return;
    } catch (e) {
      if (!isQuotaExceeded(e)) throw e;
    }

    // Retry without photos — they're by far the largest fields.
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.stats) {
        delete parsed.state.stats.summitPhoto;
        delete parsed.state.stats.landscapePhoto;
      }
      if (parsed?.state?.theme) {
        delete parsed.state.theme.backgroundImage;
      }
      if (Array.isArray(parsed?.state?.collection?.hikes)) {
        for (const h of parsed.state.collection.hikes) delete h.climberPhoto;
      }
      window.localStorage.setItem(name, JSON.stringify(parsed));
      notifyStorageWarning?.("Penyimpanan browser penuh — foto tidak tersimpan otomatis. Data lain tetap tersimpan.");
      return;
    } catch {
      /* fall through to final warning below */
    }

    // eslint-disable-next-line no-console
    console.warn("[store] localStorage penuh, perubahan terbaru tidak tersimpan (tetap tampil sampai reload).");
    notifyStorageWarning?.("Penyimpanan browser penuh — perubahan terbaru tidak tersimpan setelah reload.");
  },
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      // Runs synchronously during create(), i.e. before persist can possibly
      // call storage.setItem — safe to wire up here.
      //
      // IMPORTANT: persist's middleware calls storage.setItem() after EVERY
      // set() call, unconditionally (see zustand/middleware.mjs — it wraps
      // api.setState to always re-persist). So calling set() here without a
      // guard would recurse forever: setItem succeeds -> notify(null) ->
      // set() -> persist re-serializes -> setItem() -> notify(null) -> set()
      // -> ... This bailout (skip set() when the value is unchanged) is what
      // breaks that cycle.
      notifyStorageWarning = (msg) => {
        if (get().storageWarning !== msg) set({ storageWarning: msg });
      };

      return {
      sizeSetup: DEFAULT_SIZE_SETUP,
      posterSize: computeInitialPosterSize(),
      gpxFileName: null,
      gpxData: null,
      markers: [],
      stats: DEFAULT_STATS,
      theme: DEFAULT_THEME,
      export3d: DEFAULT_EXPORT_3D,
      posterMode: "single",
      collection: DEFAULT_COLLECTION,
      storageWarning: null,
      hasHydrated: false,

      setSizeSetup: (patch) => {
        const next = { ...get().sizeSetup, ...patch };
        set({ sizeSetup: next, posterSize: resolvePosterSize(next) });
      },

      setGpxData: (fileName, data) => {
        const basecamp: RouteMarker = {
          id: crypto.randomUUID(),
          type: "basecamp",
          label: "Basecamp",
          trackIndex: 0,
        };
        const summit: RouteMarker = {
          id: crypto.randomUUID(),
          type: "summit",
          label: "Puncak",
          trackIndex: data.points.length - 1,
        };
        set({
          gpxFileName: fileName,
          gpxData: data,
          markers: [basecamp, summit],
          stats: {
            ...get().stats,
            distanceKm: Math.round(data.distanceKm * 100) / 100,
            elevationGainM: Math.round(data.elevationGainM),
            summitElevationM: Math.round(data.maxEle),
          },
        });
      },

      setMarkers: (markers) => set({ markers }),

      addMarker: (marker) => set({ markers: [...get().markers, marker] }),

      updateMarker: (id, patch) =>
        set({
          markers: get().markers.map((m) => (m.id === id ? { ...m, ...patch } : m)),
        }),

      removeMarker: (id) => set({ markers: get().markers.filter((m) => m.id !== id) }),

      reorderPosMarkers: (orderedIds) => {
        const markers = get().markers;
        const byId = new Map(markers.map((m) => [m.id, m]));
        const posOrdered = orderedIds
          .map((id) => byId.get(id))
          .filter((m): m is RouteMarker => !!m)
          .map((m, idx) => ({ ...m, order: idx }));
        const others = markers.filter((m) => m.type !== "pos");
        set({ markers: [...others, ...posOrdered] });
      },

      setStats: (patch) => set({ stats: { ...get().stats, ...patch } }),
      setTheme: (patch) => set({ theme: { ...get().theme, ...patch } }),
      setExport3d: (patch) => set({ export3d: { ...get().export3d, ...patch } }),
      setStorageWarning: (msg) => set({ storageWarning: msg }),

      setPosterMode: (mode) => set({ posterMode: mode }),

      setCollectionMeta: (patch) => set({ collection: { ...get().collection, ...patch } }),

      addHike: () => {
        const { hikes } = get().collection;
        if (hikes.length >= MAX_COLLECTION_HIKES) return;
        set({ collection: { ...get().collection, hikes: [...hikes, makeEmptyHike()] } });
      },

      updateHike: (id, patch) =>
        set({
          collection: {
            ...get().collection,
            hikes: get().collection.hikes.map((h) => (h.id === id ? { ...h, ...patch } : h)),
          },
        }),

      removeHike: (id) => {
        const { hikes } = get().collection;
        if (hikes.length <= MIN_COLLECTION_HIKES) return;
        set({ collection: { ...get().collection, hikes: hikes.filter((h) => h.id !== id) } });
      },

      setHikeGpx: (id, fileName, data) =>
        set({
          collection: {
            ...get().collection,
            hikes: get().collection.hikes.map((h) =>
              h.id === id
                ? {
                    ...h,
                    gpxFileName: fileName,
                    gpxData: data,
                    distanceKm: Math.round(data.distanceKm * 100) / 100,
                    elevationGainM: Math.round(data.elevationGainM),
                    summitElevationM: Math.round(data.maxEle),
                  }
                : h
            ),
          },
        }),

      reset: () =>
        set({
          sizeSetup: DEFAULT_SIZE_SETUP,
          posterSize: computeInitialPosterSize(),
          gpxFileName: null,
          gpxData: null,
          markers: [],
          stats: DEFAULT_STATS,
          theme: DEFAULT_THEME,
          export3d: DEFAULT_EXPORT_3D,
          posterMode: "single",
          collection: { ...DEFAULT_COLLECTION, hikes: [makeEmptyHike(), makeEmptyHike()] },
        }),
      };
    },
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        sizeSetup: state.sizeSetup,
        gpxFileName: state.gpxFileName,
        gpxData: state.gpxData,
        markers: state.markers,
        stats: state.stats,
        theme: state.theme,
        export3d: state.export3d,
        posterMode: state.posterMode,
        collection: state.collection,
      }),
      // Backfill defaults so state persisted by an older version always has every
      // field defined (prevents React controlled/uncontrolled input warnings when
      // new fields like headerLabel/summitElevationM are added later).
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        const persistedCollection = p.collection as CollectionData | undefined;
        return {
          ...current,
          ...p,
          sizeSetup: { ...DEFAULT_SIZE_SETUP, ...(p.sizeSetup ?? {}) },
          stats: { ...DEFAULT_STATS, ...(p.stats ?? {}) },
          theme: { ...DEFAULT_THEME, ...(p.theme ?? {}) },
          export3d: { ...DEFAULT_EXPORT_3D, ...(p.export3d ?? {}) },
          collection:
            persistedCollection && Array.isArray(persistedCollection.hikes) && persistedCollection.hikes.length >= MIN_COLLECTION_HIKES
              ? {
                  ...DEFAULT_COLLECTION,
                  ...persistedCollection,
                  hikes: persistedCollection.hikes.map((h) => ({ ...makeEmptyHike(), ...h })),
                }
              : DEFAULT_COLLECTION,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.posterSize = resolvePosterSize(state.sizeSetup);
          state.hasHydrated = true;
        }
      },
    }
  )
);

export type { TrackPoint };
