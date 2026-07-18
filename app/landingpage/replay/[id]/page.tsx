import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { ChevronLeft, Mountain } from "lucide-react";
import ReplayPlayer from "@/components/ReplayPlayer";
import { readReplay } from "@/lib/replayStore.server";

/* ============================================================================
 * Halaman publik Summit Replay — dibuka customer/tamu lewat scan QR poster.
 * Route ini otomatis publik (allowlist proxy: startsWith "/landingpage/").
 * Data dibaca server-side per request; id tak dikenal → kartu "tidak
 * ditemukan" bergaya clay.
 * ========================================================================== */

export const dynamic = "force-dynamic";

/** Satu kali baca per request meski dipanggil metadata + page. */
const getReplay = cache(readReplay);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await getReplay(id);
  const name = data ? (data.kind === "single" ? data.name : data.title) : null;
  return {
    title: { absolute: name ? `Summit Replay — ${name} | myKoordinat` : "Summit Replay | myKoordinat" },
    description: "Putar ulang pendakian: pergerakan jalur dari basecamp ke puncak, profil elevasi, dan waktu tempuh.",
  };
}

export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getReplay(id);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="clay-card w-full max-w-sm p-8 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white">
            <Mountain size={20} />
          </span>
          <h1 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">Replay tidak ditemukan</h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            Link replay ini tidak dikenal atau sudah tidak tersedia.
          </p>
          <Link
            href="/landingpage"
            className="clay-chip mx-auto mt-5 flex w-fit items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-300"
          >
            <ChevronLeft size={14} />
            ke myKoordinat
          </Link>
        </div>
      </div>
    );
  }

  return <ReplayPlayer data={data} />;
}
