import Link from "next/link";
import { ArrowRight, Check, MessageCircle, Mountain } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { PACKAGES, WA_NUMBER } from "@/lib/landing";

/* ============================================================================
 * Landing page jualan (etalase) — poster pendakian custom 20×30 cm dari GPX.
 * Hero + apa yang tercetak + pilihan paket. Cara pesan & form ada di halaman
 * terpisah /landingpage/pesan.
 * ========================================================================== */

const PESAN_HREF = "/landingpage/pesan";
const HEMAT = PACKAGES.find((p) => p.id === "hemat")!;

/* ---- Visual mini per item "Yang tercetak" ---- */

/** Potongan (crop) dari foto poster asli — fokus ke elemen tertentu. */
function Crop({ x, y, zoom }: { x: number; y: number; zoom: number }) {
  return (
    <div
      aria-hidden
      className="h-20 w-28 shrink-0 rounded-xl border border-zinc-300/60 bg-zinc-900 shadow-md dark:border-zinc-700/60"
      style={{
        backgroundImage: "url(/contoh-poster-lawu.jpg)",
        backgroundSize: `${zoom * 100}%`,
        backgroundPosition: `${x}% ${y}%`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/** Ilustrasi jalur 3D timbul: rute putih dengan bayangan/bevel di atas peta gelap. */
function Visual3D() {
  const d = "M18,66 C30,58 34,44 48,40 C64,35 66,24 82,18 C90,15 96,12 102,10";
  return (
    <svg viewBox="0 0 112 80" aria-hidden className="h-20 w-28 shrink-0 rounded-xl border border-zinc-300/60 shadow-md dark:border-zinc-700/60">
      <defs>
        <linearGradient id="v3d-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#282050" />
          <stop offset="1" stopColor="#743f30" />
        </linearGradient>
      </defs>
      <rect width="112" height="80" rx="10" fill="url(#v3d-bg)" />
      <g stroke="rgba(251,245,234,0.12)" strokeWidth="1" fill="none">
        <path d="M6,30 C30,22 50,38 76,28 C92,22 104,30 110,26" />
        <path d="M2,52 C28,44 54,60 82,48 C96,42 106,50 112,46" />
      </g>
      {/* bayangan jatuh → kesan mengambang/timbul */}
      <path d={d} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="7" strokeLinecap="round" transform="translate(3.5,4.5)" />
      {/* badan jalur (dinding samping) */}
      <path d={d} fill="none" stroke="#b8b2a4" strokeWidth="7" strokeLinecap="round" transform="translate(1.5,2)" />
      {/* permukaan atas terang — menggambar dirinya sendiri berulang */}
      <path d={d} pathLength={100} className="t3d-draw" fill="none" stroke="#fdfaf2" strokeWidth="6" strokeLinecap="round" />
      <circle cx="102" cy="10" r="4.5" fill="#ef4444" stroke="#fff" strokeWidth="1.8" />
    </svg>
  );
}

/** Ilustrasi foto background: foto lanskap dibaurkan gradasi sunset. */
function VisualBg() {
  return (
    <div aria-hidden className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-zinc-300/60 shadow-md dark:border-zinc-700/60">
      {/* foto rumput dari poster asli sebagai "foto latar" */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url(/contoh-poster-lawu.jpg)",
          backgroundSize: "420%",
          backgroundPosition: "88% 70%",
        }}
      />
      {/* gradasi sunset menimpa foto — persis perilaku fitur background */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(180deg, rgba(28,23,64,0.85) 0%, rgba(67,50,77,0.62) 45%, rgba(185,117,43,0.55) 100%)",
        }}
      />
      <span className="absolute bottom-1.5 left-2 font-mono text-[8px] uppercase tracking-widest text-[#ffcf8a]">
        50% blend
      </span>
    </div>
  );
}

/* ---- Konten poster: daftar editorial bervisual, bukan grid kartu generik ---- */
const POSTER_CONTENTS: { n: string; title: string; desc: string; visual: React.ReactNode }[] = [
  {
    n: "01",
    title: "Jalur asli dari file GPX",
    desc: "Bukan template. Peta digambar dari rekaman pendakianmu sendiri (Strava, Garmin, AllTrails, dll).",
    visual: <Crop x={22} y={62} zoom={3.2} />,
  },
  {
    n: "02",
    title: "Jalur 3D timbul, dicetak 3D printer",
    desc: "Jalurnya tidak cuma dicetak datar. Rutenya dicetak dengan 3D printer skala 1:1 dengan peta, ditempel mengikuti jalur di poster. Terlihat dan teraba timbul.",
    visual: <Visual3D />,
  },
  {
    n: "03",
    title: "Basecamp, pos, dan puncak",
    desc: "Setiap titik penting diberi label di jalur, lengkap dengan posisinya di profil elevasi.",
    visual: <Crop x={26} y={30} zoom={3.6} />,
  },
  {
    n: "04",
    title: "Profil elevasi",
    desc: "Naik-turun medan yang kamu lalui, tergambar sebagai grafik ketinggian di bawah peta.",
    visual: <Crop x={25} y={97} zoom={4} />,
  },
  {
    n: "05",
    title: "Statistik pendakian",
    desc: "Ketinggian puncak, jarak, elevation gain, waktu tempuh, dan pace, semuanya dihitung dari data GPX.",
    visual: <Crop x={65} y={42} zoom={4.5} />,
  },
  {
    n: "06",
    title: "Dua foto pendakianmu",
    desc: "Dua slot foto (momen di puncak dan lanskap favoritmu) tercetak di samping statistik, plus QR code menuju link pilihanmu: Strava, Instagram, Linktree, atau apa pun.",
    visual: <Crop x={71} y={70} zoom={2.4} />,
  },
  {
    n: "07",
    title: "Foto background (opsional)",
    desc: "Satu foto panorama bisa dijadikan latar seluruh poster, dibaurkan dengan gradasi warna sunset. Transparansinya bisa diatur sesuai selera.",
    visual: <VisualBg />,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-clip">
      {/* ---- header ---- */}
      <header className="sticky top-0 z-40 px-4 pt-3 pb-1">
        <div className="clay-card mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 !rounded-full px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white">
              <Mountain size={16} />
            </span>
            <span className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              myKoordinat
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              href={PESAN_HREF}
              className="t3d-btn flex items-center gap-1.5 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-4 py-2 text-xs font-semibold text-white sm:text-sm"
            >
              <MessageCircle size={14} />
              Pesan Sekarang
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-5xl px-4">
        {/* orb dekoratif di belakang hero */}
        <div aria-hidden className="t3d-orb -left-32 top-10 h-72 w-72" />
        <div aria-hidden className="t3d-orb -right-24 top-[26rem] h-56 w-56" />
        {/* ---- hero ---- */}
        <section className="grid grid-cols-1 items-center gap-10 py-12 sm:py-16 lg:grid-cols-[5fr_6fr]">
          <div>
            <p className="t3d-in t3d-in-1 font-mono text-[11px] uppercase tracking-[0.25em] text-[#b8532f] dark:text-[#e59a7c]">
              Poster pendakian custom dari file GPX
            </p>
            <h1 className="t3d-text t3d-in t3d-in-2 mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-[#3d3929] sm:text-5xl dark:text-[#f0eee4]">
              Jejak pendakianmu, jadi poster yang layak dipajang.
            </h1>
            <p className="t3d-in t3d-in-3 mt-5 max-w-md text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              Kirim rekaman GPX-mu, lalu jalur, pos, profil elevasi, dan statistik
              pendakianmu dirangkum jadi satu poster <strong className="font-semibold text-zinc-800 dark:text-zinc-200">20x30 cm</strong>,
              dengan <strong className="font-semibold text-zinc-800 dark:text-zinc-200">jalur dicetak timbul pakai 3D printer</strong> presisi
              1:1 mengikuti peta. Tiap poster dikerjakan satu-satu, bukan hasil template.
            </p>

            <div className="t3d-in t3d-in-4 mt-7 flex flex-wrap items-end gap-x-3 gap-y-2">
              <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Mulai</span>
              <span className="t3d-text text-4xl font-extrabold tracking-tight text-[#b8532f] dark:text-[#e59a7c]">
                {HEMAT.price}
              </span>
              <span className="clay-chip mb-1 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest text-[#9c4a2c] dark:text-[#e59a7c]">
                2 pilihan paket
              </span>
            </div>

            <div className="t3d-in t3d-in-5 mt-7 flex flex-wrap items-center gap-4">
              <Link
                href={PESAN_HREF}
                className="t3d-btn flex items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-7 py-3.5 text-sm font-semibold text-white"
              >
                Pilih paket & pesan
                <ArrowRight size={15} />
              </Link>
              <p className="text-xs leading-snug text-zinc-400 dark:text-zinc-500">
                Bayar setelah preview kamu setujui.
              </p>
            </div>
          </div>

          <figure className="t3d-scene t3d-in-pop relative">
            <div className="t3d-float">
              <div className="t3d-poster overflow-hidden rounded-xl bg-[var(--clay-surface)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/contoh-poster-lawu.jpg"
                  alt="Hasil poster asli: Gunung Lawu via Cemoro Sewu. Peta jalur, profil elevasi, statistik, dua foto pendakian, dan QR code"
                  width={1800}
                  height={1200}
                  className="h-auto w-full rounded-lg"
                />
              </div>
              {/* chip spesifikasi melayang di sudut poster */}
              <span className="t3d-coin t3d-float-slow absolute -left-3 top-6 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest sm:-left-6">
                Jalur 3D timbul
              </span>
              <span className="t3d-coin t3d-float-slow absolute -right-2 bottom-10 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest [animation-delay:1.6s] sm:-right-5">
                300 DPI
              </span>
            </div>
            <figcaption className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">
              Hasil asli: Gunung Lawu via Cemoro Sewu, 20x30 cm, 300 DPI
            </figcaption>
          </figure>
        </section>

        {/* ---- strip spesifikasi (marquee berjalan, pause saat hover) ---- */}
        <div className="t3d-marquee border-y border-zinc-300/60 py-4 dark:border-zinc-700/60">
          <div>
            {[0, 1].map((dup) => (
              <p
                key={dup}
                aria-hidden={dup === 1}
                className="flex shrink-0 items-center gap-x-3 pr-3 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:text-[11px] dark:text-zinc-400"
              >
                <span>20x30 cm landscape</span>
                <span className="text-[#c05d3d]">|</span>
                <span>Jalur 3D timbul</span>
                <span className="text-[#c05d3d]">|</span>
                <span>Dari GPX asli</span>
                <span className="text-[#c05d3d]">|</span>
                <span>Jalur + pos + elevasi</span>
                <span className="text-[#c05d3d]">|</span>
                <span>300 DPI</span>
                <span className="text-[#c05d3d]">|</span>
              </p>
            ))}
          </div>
        </div>

        {/* ---- isi poster ---- */}
        <section className="t3d-scene py-14 sm:py-20">
          <h2 className="t3d-text max-w-md text-2xl font-extrabold tracking-tight text-[#3d3929] sm:text-3xl dark:text-[#f0eee4]">
            Yang tercetak di postermu
          </h2>
          <div className="mt-8 flex flex-col gap-5">
            {POSTER_CONTENTS.map((item, i) => (
              <div key={item.n} className="t3d-reveal">
                <div className={`t3d-card ${i % 2 === 1 ? "t3d-card-r" : ""} flex items-center gap-5 p-5 sm:gap-7 sm:p-6`}>
                  {item.visual}
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-sm font-bold text-[#c05d3d] dark:text-[#e59a7c]">{item.n}</span>
                      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</h3>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- paket ---- */}
        <section className="t3d-scene relative pb-14 sm:pb-20">
          <div aria-hidden className="t3d-orb -left-24 bottom-0 h-64 w-64" />
          <h2 className="t3d-text text-2xl font-extrabold tracking-tight text-[#3d3929] sm:text-3xl dark:text-[#f0eee4]">
            Pilih paketmu
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Dua-duanya cetak tajam 300 DPI dengan jalur 3D timbul. Bedanya cuma
            di media pajang — pilih yang paling pas buat dindingmu.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-7 sm:grid-cols-2">
            {PACKAGES.map((p, i) => (
              <div key={p.id} className="t3d-reveal flex">
              <div className={`t3d-card ${i % 2 === 1 ? "t3d-card-r" : ""} flex w-full flex-col p-6 sm:p-7`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{p.name}</h3>
                  <span className="t3d-coin px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide">
                    {p.badge}
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="t3d-text text-3xl font-extrabold tracking-tight text-[#b8532f] dark:text-[#e59a7c]">{p.price}</span>
                  <span className="text-sm text-zinc-400">/ poster</span>
                </div>
                <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-300">{p.tagline}</p>
                <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                  {p.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                      <Check size={16} className="mt-0.5 shrink-0 text-[#c05d3d] dark:text-[#e59a7c]" />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Link
                  href={PESAN_HREF}
                  className="t3d-btn mt-6 flex items-center justify-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-6 py-3 text-sm font-semibold text-white"
                >
                  Pesan {p.name}
                  <ArrowRight size={15} />
                </Link>
              </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Belum punya file GPX? Tenang — bisa dibantu admin. Detailnya di halaman pesan.
          </p>
        </section>
      </main>

      <footer className="border-t border-zinc-200/70 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800/70 dark:text-zinc-600">
        myKoordinat | poster pendakian custom dari file GPX | WhatsApp {WA_NUMBER.replace(/^62/, "0")}
      </footer>
    </div>
  );
}
