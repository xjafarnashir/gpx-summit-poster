/* Konstanta bersama landing page: nomor WA, paket poster, langkah pesan.
 * Dipakai oleh /landingpage (etalase) dan /landingpage/pesan (form). */

export const WA_NUMBER = "6285117084521";

export const waAskGpxUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(
  "Halo admin! Saya mau pesan poster pendakian, tapi belum punya file GPX. Bisa dibantu?"
)}`;

export type PackageId = "hemat" | "premium";

export interface PosterPackage {
  id: PackageId;
  name: string;
  price: string;
  /** Harga coret (awal, sebelum promo) — diisi applyPricing bila disetel. */
  strike?: string;
  /** Media/mounting fisik. */
  mount: string;
  tagline: string;
  badge: string;
  features: string[];
}

/* Kedua paket sama-sama cetak 300 DPI + jalur 3D timbul. Bedanya di media —
 * copy sengaja menempatkan Hemat sebagai pilihan cerdas (ringan, awet, laris),
 * bukan "versi murahan". */
export const PACKAGES: PosterPackage[] = [
  {
    id: "hemat",
    name: "Paket Hemat",
    price: "Rp50.000",
    mount: "Papan solid anti-rayap 5 mm",
    tagline: "Ringan, tahan air & rayap, awet dipajang",
    badge: "Paling laris",
    features: [
      "Cetak tajam 300 DPI",
      "Jalur 3D timbul (3D printer)",
      "Papan solid 5 mm — anti-rayap & tahan air",
      "Ringan, tak melengkung, gampang digantung",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "Rp80.000",
    mount: "Frame blok kayu tebal 2,5 cm",
    tagline: "Tebal, kokoh, berkesan galeri",
    badge: "Paling tebal",
    features: [
      "Cetak tajam 300 DPI",
      "Jalur 3D timbul (3D printer)",
      "Frame blok kayu tebal 2,5 cm",
      "Berdiri dimensional di dinding",
      "Finishing rapi siap pajang",
    ],
  },
];

export const packageById = (id: string): PosterPackage => PACKAGES.find((p) => p.id === id) ?? PACKAGES[0];

export const STEPS: { n: string; title: string; desc: string }[] = [
  { n: "1", title: "Pilih paket & isi data", desc: "Pilih Hemat/Premium, 1 pendakian atau koleksi, lalu isi data yang mau tercetak." },
  { n: "2", title: "Lihat preview & lanjut WA", desc: "Preview muncul langsung. Klik lanjut — chat WhatsApp terbuka dengan semua datamu terisi." },
  { n: "3", title: "Kirim GPX + foto", desc: "Setelah DP, kirim file .gpx dan fotomu di chat. Preview final dikirim sebelum produksi." },
];
