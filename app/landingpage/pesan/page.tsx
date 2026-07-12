import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, FileQuestion, MessageCircle, Mountain } from "lucide-react";
import LandingOrder from "@/components/LandingOrder";
import { STEPS, WA_NUMBER, waAskGpxUrl } from "@/lib/landing";

export const metadata: Metadata = {
  title: "Pesan Poster Pendakian — myKoordinat",
  description: "Pilih paket, isi data pendakianmu, lihat preview langsung, lalu pesan via WhatsApp. File GPX & foto menyusul di chat.",
};

export default function PesanPage() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 px-4 pt-3 pb-1">
        <div className="clay-card mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 !rounded-full px-4">
          <Link href="/landingpage" className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white">
              <Mountain size={16} />
            </span>
            <span className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">myKoordinat</span>
          </Link>
          <Link
            href="/landingpage"
            className="clay-chip flex shrink-0 items-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 sm:text-sm"
          >
            <ChevronLeft size={14} />
            Kembali
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-14">
        {/* ---- cara pesan ---- */}
        <section>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#3d3929] sm:text-3xl dark:text-[#f0eee4]">Cara pesan</h1>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="clay-card p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-sm font-bold text-white">
                  {s.n}
                </span>
                <h3 className="mt-4 text-base font-semibold text-zinc-900 dark:text-zinc-100">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- banner: belum punya file GPX ---- */}
        <section className="mt-10 sm:mt-14">
          <div className="clay-card flex flex-col items-start gap-5 bg-gradient-to-r from-[#f7e9e1] to-[#faf9f5] p-6 sm:flex-row sm:items-center sm:gap-7 sm:p-7 dark:from-[#3a2a22] dark:to-[#30302e]">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-md">
              <FileQuestion size={22} />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold tracking-tight text-[#3d3929] sm:text-xl dark:text-[#f0eee4]">
                Belum punya file GPX? Jangan risau.
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                Tetap bisa pesan. Ceritakan pendakianmu ke admin — jalurnya dibantu
                dicarikan, atau kamu dipandu cara ambil GPX dari Strava & aplikasi lain.
              </p>
            </div>
            <a
              href={waAskGpxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-btn flex shrink-0 items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
            >
              <MessageCircle size={15} />
              Tanya Admin
            </a>
          </div>
        </section>

        {/* ---- form pesan + preview ---- */}
        <section className="mt-12 sm:mt-16">
          <LandingOrder />
        </section>
      </main>

      <footer className="border-t border-zinc-200/70 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800/70 dark:text-zinc-600">
        myKoordinat | poster pendakian custom dari file GPX | WhatsApp {WA_NUMBER.replace(/^62/, "0")}
      </footer>
    </div>
  );
}
