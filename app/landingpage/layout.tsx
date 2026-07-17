import type { Metadata } from "next";
import { formatRupiah } from "@/lib/pricing";
import { readPricing } from "@/lib/pricingStore.server";

/* Meta description ikut harga terbaru yang disetel admin dari /editor. */
export async function generateMetadata(): Promise<Metadata> {
  const pricing = await readPricing();
  return {
    title: { absolute: "myKoordinat - Poster Pendakian Custom dari GPX, 20x30 cm" },
    description:
      `Ubah rekaman GPX pendakianmu jadi poster 20x30 cm dengan jalur 3D timbul: jalur asli, pos, profil elevasi, statistik, dua foto pendakian, dan foto background opsional. Promo ${formatRupiah(pricing.hemat)}. Pesan via WhatsApp.`,
  };
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
