import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "myKoordinat - Poster Pendakian Custom dari GPX, 20x30 cm" },
  description:
    "Ubah rekaman GPX pendakianmu jadi poster 20x30 cm dengan jalur 3D timbul: jalur asli, pos, profil elevasi, statistik, dua foto pendakian, dan foto background opsional. Promo Rp50.000. Pesan via WhatsApp.",
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
