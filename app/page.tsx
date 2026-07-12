"use client";

import Link from "next/link";
import { ArrowRight, Box, Map as MapIcon, Printer } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import SizeSetup from "@/components/SizeSetup";

const FEATURES = [
  { icon: MapIcon, label: "Peta & rute dari GPX" },
  { icon: Printer, label: "Poster siap cetak (PNG 300 DPI)" },
  { icon: Box, label: "File 3D print rute, skala 1:1" },
];

export default function Home() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col overflow-y-auto px-4 py-8">
        <section className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#3d3929] sm:text-4xl dark:text-[#f0eee4]">
            Abadikan pendakianmu jadi poster
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
            Upload rekaman GPX, atur cerita pendakianmu, lalu export poster siap
            cetak — lengkap dengan file 3D print rute yang presisi 1:1 dengan
            posternya.
          </p>
          <ul className="mx-auto mt-5 flex max-w-lg flex-wrap items-center justify-center gap-2">
            {FEATURES.map((f) => (
              <li
                key={f.label}
                className="clay-chip flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
              >
                <f.icon size={13} className="text-[#c05d3d] dark:text-[#e59a7c]" />
                {f.label}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-6">
          <SizeSetup />

          <div className="flex items-center justify-end gap-3">
            <Link
              href="/editor"
              className="clay-btn flex items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              Lanjut ke Editor
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-200/70 py-5 text-center text-xs text-zinc-400 dark:border-zinc-800/70 dark:text-zinc-600">
        GPX Summit Poster — peta © OpenStreetMap · © CARTO · © OpenTopoMap
      </footer>
    </div>
  );
}
