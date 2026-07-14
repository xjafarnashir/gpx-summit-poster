/* Preset tema LATAR poster (gradasi penuh di belakang peta + blok bawah).
 * Semua bergerak dari gelap di atas → warna di bawah, supaya teks cream/gold
 * tetap terbaca. Dipakai renderer (single + koleksi), editor, dan landing. */

export type BackgroundThemeId = "sunset" | "midnight" | "forest" | "charcoal";

export interface BackgroundTheme {
  id: BackgroundThemeId;
  label: string;
  /** Stop gradasi vertikal [posisi 0..1, warna]. */
  stops: [number, string][];
  /** CSS linear-gradient untuk swatch di UI. */
  css: string;
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
  {
    id: "sunset",
    label: "Sunset",
    stops: [
      [0.0, "#1c1740"],
      [0.3, "#282050"],
      [0.48, "#43324d"],
      [0.62, "#743f30"],
      [0.78, "#9e5a25"],
      [1.0, "#b9752b"],
    ],
    css: "linear-gradient(180deg,#1c1740 0%,#743f30 65%,#b9752b 100%)",
  },
  {
    id: "midnight",
    label: "Midnight",
    stops: [
      [0.0, "#0a0e24"],
      [0.4, "#14204a"],
      [0.7, "#26406e"],
      [1.0, "#3a6ea5"],
    ],
    css: "linear-gradient(180deg,#0a0e24 0%,#26406e 65%,#3a6ea5 100%)",
  },
  {
    id: "forest",
    label: "Forest",
    stops: [
      [0.0, "#0c1f1a"],
      [0.4, "#153a2c"],
      [0.7, "#2f5a34"],
      [1.0, "#5c7a34"],
    ],
    css: "linear-gradient(180deg,#0c1f1a 0%,#2f5a34 65%,#5c7a34 100%)",
  },
  {
    id: "charcoal",
    label: "Monokrom",
    stops: [
      [0.0, "#141414"],
      [0.45, "#232323"],
      [0.75, "#3a3634"],
      [1.0, "#5a4f45"],
    ],
    css: "linear-gradient(180deg,#141414 0%,#3a3634 70%,#5a4f45 100%)",
  },
];

export function bgThemeById(id?: string): BackgroundTheme {
  return BACKGROUND_THEMES.find((t) => t.id === id) ?? BACKGROUND_THEMES[0];
}
