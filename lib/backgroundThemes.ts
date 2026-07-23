/* Preset tema LATAR poster (gradasi penuh di belakang peta + blok bawah).
 * Tema GELAP bergerak dari gelap di atas → warna di bawah, supaya teks
 * cream/gold tetap terbaca. Tema TERANG (mis. "bone") justru butuh tinta
 * GELAP; renderer memilih palet tinta lewat inkFor(). Dipakai renderer
 * (single + koleksi), editor, dan landing. */

export type BackgroundThemeId = "sunset" | "midnight" | "forest" | "charcoal" | "bone";

export interface BackgroundTheme {
  id: BackgroundThemeId;
  label: string;
  /** Mode tinta: "dark" = latar gelap + teks cream; "light" = latar terang + teks gelap. */
  mode: "light" | "dark";
  /** Stop gradasi vertikal [posisi 0..1, warna]. */
  stops: [number, string][];
  /** CSS linear-gradient untuk swatch di UI. */
  css: string;
}

export const BACKGROUND_THEMES: BackgroundTheme[] = [
  {
    id: "sunset",
    label: "Sunset",
    mode: "dark",
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
    mode: "dark",
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
    mode: "dark",
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
    mode: "dark",
    stops: [
      [0.0, "#141414"],
      [0.45, "#232323"],
      [0.75, "#3a3634"],
      [1.0, "#5a4f45"],
    ],
    css: "linear-gradient(180deg,#141414 0%,#3a3634 70%,#5a4f45 100%)",
  },
  {
    // Tema TERANG "Putih Tulang": kertas hangat netral, tinta charcoal, aksen
    // emas tua. Gradasi sengaja nyaris rata (paper-like), sedikit lebih dalam di
    // bawah agar ada kedalaman tanpa mengurangi keterbacaan tinta gelap.
    id: "bone",
    label: "Putih Tulang",
    mode: "light",
    stops: [
      [0.0, "#f7f5f0"],
      [0.5, "#f1ece2"],
      [1.0, "#e9e2d4"],
    ],
    css: "linear-gradient(180deg,#f7f5f0 0%,#f1ece2 55%,#e9e2d4 100%)",
  },
];

export function bgThemeById(id?: string): BackgroundTheme {
  return BACKGROUND_THEMES.find((t) => t.id === id) ?? BACKGROUND_THEMES[0];
}

/* ============================================================================
 * PALET TINTA (ink) untuk renderer poster. Semua teks/garis/panel yang digambar
 * DI ATAS LATAR poster memakai palet ini, sehingga tema terang otomatis memakai
 * tinta gelap. Elemen yang digambar DI ATAS PETA (rute, marker, label marker,
 * kotak QR) tetap terang karena peta selalu diberi tint gelap — jangan pakai
 * palet ini untuk elemen di atas peta.
 * ========================================================================== */
export interface InkPalette {
  /** Teks utama (judul, angka hero). */
  cream: string;
  /** Teks sekunder (subtitle, unit, caption). */
  creamSoft: string;
  /** Teks tersier (atribusi, middot). */
  creamMuted: string;
  /** Garis samar (frame, gridline, divider tipis). */
  creamFaint: string;
  /** Aksen (underline, label stat, tick). */
  gold: string;
  /** Warna ikon kecil (kalender, hiker) yang digambar di latar poster. */
  icon: string;
  /** Latar kartu per-gunung (koleksi). */
  panelBg: string;
  /** Border kartu per-gunung (koleksi). */
  panelBorder: string;
  /** Garis pembatas tebal (divider blok ekspedisi, rule stat). */
  divider: string;
  /** Teks quote/deskripsi ekspedisi (italic). */
  quote: string;
  /** true bila latar terang (renderer melewati scrim gelap). */
  lightBg: boolean;
}

export const INK_DARK: InkPalette = {
  cream: "#fbf5ea",
  creamSoft: "rgba(251,245,234,0.82)",
  creamMuted: "rgba(251,245,234,0.62)",
  creamFaint: "rgba(251,245,234,0.32)",
  gold: "#ffcf8a",
  icon: "#ffcf8a",
  panelBg: "rgba(12,9,24,0.32)",
  panelBorder: "rgba(251,245,234,0.14)",
  divider: "rgba(251,245,234,0.22)",
  quote: "rgba(251,245,234,0.72)",
  lightBg: false,
};

export const INK_LIGHT: InkPalette = {
  cream: "#23201b",
  creamSoft: "rgba(35,32,27,0.80)",
  creamMuted: "rgba(35,32,27,0.55)",
  creamFaint: "rgba(35,32,27,0.24)",
  gold: "#97671b",
  icon: "#97671b",
  panelBg: "rgba(255,255,255,0.45)",
  panelBorder: "rgba(35,32,27,0.12)",
  divider: "rgba(35,32,27,0.20)",
  quote: "rgba(35,32,27,0.68)",
  lightBg: true,
};

/** Palet tinta untuk sebuah tema latar (default: gelap). */
export function inkFor(id?: string): InkPalette {
  return bgThemeById(id).mode === "light" ? INK_LIGHT : INK_DARK;
}
