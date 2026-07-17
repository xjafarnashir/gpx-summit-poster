"use client";

import { useState } from "react";
import { MoreVertical } from "lucide-react";

/**
 * Menu "⋮" di navbar /editor: menampung aksi yang jarang dipakai supaya bar
 * utama tetap muat di layar HP. Panel dirender `fixed` agar tidak terpotong
 * oleh scroll container .navbar-actions; label ikon yang normalnya
 * disembunyikan di mobile dipaksa tampil di dalam panel.
 */
export default function NavMore({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Menu lainnya"
        aria-expanded={open}
        className="clay-chip flex items-center px-2.5 py-2 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <>
          {/* klik di luar = tutup */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Panel TIDAK menutup saat item diklik — modal anak (mis. Harga)
              butuh tetap ter-mount. Tutup lewat klik area luar / tombol ⋮. */}
          <div className="clay-card fixed right-4 top-[4.5rem] z-50 flex w-60 flex-col gap-2 !rounded-2xl p-3 [&_span.hidden]:!inline [&>*]:w-full [&>a]:justify-start [&>button]:justify-start">
            {children}
          </div>
        </>
      )}
    </>
  );
}
