import Link from "next/link";
import {
  ArrowRight,
  AtSign,
  Boxes,
  Check,
  Eye,
  Hammer,
  MessageCircle,
  Mountain,
  PackageCheck,
  QrCode,
  Route,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  Upload,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { WA_NUMBER } from "@/lib/landing";
import { applyPricing, formatRupiah } from "@/lib/pricing";
import { readPricing } from "@/lib/pricingStore.server";

/* Harga bisa diubah admin dari /editor — render per request agar selalu segar. */
export const dynamic = "force-dynamic";

/* ============================================================================
 * Landing page jualan (etalase) — poster pendakian custom 20×30 cm dari GPX.
 * Hero + apa yang tercetak + pilihan paket. Cara pesan & form ada di halaman
 * terpisah /landingpage/pesan.
 * ========================================================================== */

const PESAN_HREF = "/landingpage/pesan";

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

/** Ilustrasi Summit Replay: peta gelap dengan jalur beranimasi (memutar ulang
 *  pergerakan) + badge QR kecil di sudut — isyarat "scan → animasi". */
function VisualReplay() {
  const d = "M20,64 C30,54 26,44 40,38 C56,31 54,22 70,18 C80,15 86,12 92,10";
  return (
    <svg viewBox="0 0 112 80" aria-hidden className="h-20 w-28 shrink-0 rounded-xl border border-zinc-300/60 shadow-md dark:border-zinc-700/60">
      <defs>
        <linearGradient id="vrp-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14204a" />
          <stop offset="1" stopColor="#26406e" />
        </linearGradient>
      </defs>
      <rect width="112" height="80" rx="10" fill="url(#vrp-bg)" />
      <g stroke="rgba(251,245,234,0.1)" strokeWidth="1" fill="none">
        <path d="M4,34 C28,26 48,42 74,32 C90,26 102,34 112,30" />
        <path d="M0,54 C26,46 52,62 80,50 C94,44 104,52 112,48" />
      </g>
      {/* jejak jalur samar (rute penuh) */}
      <path d={d} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" strokeLinecap="round" />
      {/* garis progres yang menggambar-ulang dirinya → kesan animasi replay */}
      <path d={d} pathLength={100} className="t3d-draw" fill="none" stroke="#ffcf8a" strokeWidth="3" strokeLinecap="round" />
      <circle cx="20" cy="64" r="3.4" fill="#38bdf8" stroke="#fff" strokeWidth="1.4" />
      <circle cx="92" cy="10" r="3.8" fill="#ef4444" stroke="#fff" strokeWidth="1.6" />
      {/* badge QR mini di sudut kanan-bawah */}
      <g transform="translate(80,54)">
        <rect width="26" height="22" rx="3" fill="#fff" />
        <g fill="#14204a">
          <rect x="3" y="3" width="6" height="6" /><rect x="17" y="3" width="6" height="6" />
          <rect x="3" y="13" width="6" height="6" />
          <rect x="12" y="3" width="2.5" height="2.5" /><rect x="12" y="8" width="2.5" height="2.5" />
          <rect x="13" y="13" width="3" height="3" /><rect x="18" y="12" width="4" height="4" /><rect x="19" y="18" width="3" height="3" />
        </g>
      </g>
    </svg>
  );
}

/** Layar "app" Summit Replay yang beranimasi penuh (CSS murni): jalur emas
 *  menggambar, pendaki menyusuri basecamp→puncak, bar progres & jam berjalan.
 *  Path pendaki disamakan dengan --replay-d di globals.css (kelas .t3d-hiker). */
const REPLAY_D = "M46,318 C86,282 66,246 108,208 C150,172 128,136 168,104 C198,80 214,70 250,58";
function ReplayScreen() {
  return (
    <div className="t3d-float-slow relative mx-auto w-full max-w-[300px]">
      <div className="overflow-hidden rounded-[2rem] border border-white/10 shadow-[0_30px_60px_-20px_rgba(20,17,45,0.6)] ring-1 ring-black/5">
        <svg viewBox="0 0 300 380" className="block w-full" role="img" aria-label="Contoh animasi Summit Replay: pergerakan pendaki dari basecamp ke puncak di peta">
          <defs>
            <linearGradient id="rp-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0e1838" />
              <stop offset="0.6" stopColor="#1b2f5c" />
              <stop offset="1" stopColor="#2b4a6b" />
            </linearGradient>
          </defs>
          <rect width="300" height="380" fill="url(#rp-sky)" />
          {/* garis kontur samar */}
          <g stroke="rgba(255,255,255,0.06)" strokeWidth="1.4" fill="none">
            <path d="M-10,110 C60,90 120,140 190,110 C240,88 280,110 310,98" />
            <path d="M-10,190 C60,170 120,220 190,190 C240,168 280,190 310,178" />
            <path d="M-10,270 C60,250 120,300 190,270 C240,248 280,270 310,258" />
          </g>
          {/* jejak jalur penuh (samar) */}
          <path d={REPLAY_D} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="5" strokeLinecap="round" />
          {/* garis progres emas — glow lebar + inti, keduanya menggambar seirama */}
          <path className="t3d-trace" pathLength={100} d={REPLAY_D} fill="none" stroke="rgba(255,207,138,0.35)" strokeWidth="11" strokeLinecap="round" />
          <path className="t3d-trace" pathLength={100} d={REPLAY_D} fill="none" stroke="#ffd89a" strokeWidth="4.5" strokeLinecap="round" />
          {/* marker basecamp & puncak */}
          <circle cx="46" cy="318" r="6.5" fill="#38bdf8" stroke="#fff" strokeWidth="2.4" />
          <circle cx="250" cy="58" r="7.5" fill="#ef4444" stroke="#fff" strokeWidth="2.4" />
          {/* pendaki bergerak menyusuri jalur */}
          <g className="t3d-hiker">
            <circle className="t3d-ping" r="10" fill="none" stroke="#ffcf8a" strokeWidth="2.2" />
            <circle r="6.5" fill="#fff" />
            <circle r="3.8" fill="#ff7a45" />
          </g>
          {/* label LIVE (kiri-atas) */}
          <g>
            <rect x="14" y="14" width="124" height="24" rx="12" fill="rgba(8,12,28,0.55)" />
            <circle className="t3d-blink" cx="28" cy="26" r="3.6" fill="#ef4444" />
            <text x="39" y="30" fontFamily="monospace" fontSize="10.5" letterSpacing="1.4" fill="#fbf5ea">SUMMIT REPLAY</text>
          </g>
          {/* bar kontrol pemutaran (bawah) */}
          <g>
            <rect x="14" y="330" width="272" height="38" rx="13" fill="rgba(8,12,28,0.62)" />
            <path d="M30,341 L30,357 L44,349 Z" fill="#ffcf8a" />
            <rect x="56" y="347" width="168" height="4.5" rx="2.25" fill="rgba(255,255,255,0.2)" />
            <rect className="t3d-fill" x="56" y="347" width="168" height="4.5" rx="2.25" fill="#ffcf8a" />
            <text x="236" y="353" fontFamily="monospace" fontSize="11" fill="#fbf5ea">02:14</text>
          </g>
        </svg>
      </div>
      {/* chip melayang */}
      <span className="t3d-coin absolute -left-3 top-8 flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest sm:-left-5">
        <ScanLine size={12} /> Scan
      </span>
      <span className="t3d-coin absolute -right-3 bottom-16 flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest [animation-delay:1.4s] sm:-right-5">
        <Timer size={12} /> Sinkron waktu
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
    desc: "Dua slot foto (momen di puncak dan lanskap favoritmu) tercetak di samping statistik pendakian.",
    visual: <Crop x={71} y={70} zoom={2.4} />,
  },
  {
    n: "07",
    title: "QR code — link biasa atau Summit Replay",
    desc: "QR di poster mengarah ke link pilihanmu (Strava, Instagram, Linktree) — atau ke Summit Replay, animasi pendakianmu yang bergerak saat discan. Selengkapnya di bawah.",
    visual: <VisualReplay />,
  },
  {
    n: "08",
    title: "Foto background (opsional)",
    desc: "Satu foto panorama bisa dijadikan latar seluruh poster, dibaurkan dengan gradasi warna sunset. Transparansinya bisa diatur sesuai selera.",
    visual: <VisualBg />,
  },
];

export default async function LandingPage() {
  const pricing = await readPricing();
  const packages = applyPricing(pricing);
  const hematPrice = formatRupiah(pricing.hemat);
  const hematStrike = pricing.hematStrike > 0 ? formatRupiah(pricing.hematStrike) : null;

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
              {hematStrike && (
                <span className="mb-1 text-lg font-semibold text-zinc-400 line-through decoration-[#c05d3d]/70 decoration-2 dark:text-zinc-500">
                  {hematStrike}
                </span>
              )}
              <span className="t3d-text text-4xl font-extrabold tracking-tight text-[#b8532f] dark:text-[#e59a7c]">
                {hematPrice}
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

            {/* chip kepercayaan */}
            <ul className="t3d-in t3d-in-5 mt-7 flex flex-wrap gap-2">
              {[
                [<Hammer key="i" size={13} />, "Dikerjakan satu-satu"],
                [<Route key="i" size={13} />, "GPX apa pun"],
                [<ShieldCheck key="i" size={13} />, "Bayar setelah preview"],
                [<Truck key="i" size={13} />, "Kirim se-Indonesia"],
              ].map(([icon, label]) => (
                <li
                  key={label as string}
                  className="clay-chip flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300"
                >
                  <span className="text-[#c05d3d] dark:text-[#e59a7c]">{icon}</span>
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <figure className="t3d-scene t3d-in-pop relative">
            <div className="t3d-float">
              <div className="t3d-poster relative overflow-hidden rounded-xl bg-[var(--clay-surface)] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/contoh-poster-lawu.jpg"
                  alt="Hasil poster asli: Gunung Lawu via Cemoro Sewu. Peta jalur, profil elevasi, statistik, dua foto pendakian, dan QR code"
                  width={1800}
                  height={1200}
                  className="h-auto w-full rounded-lg"
                />
                {/* sapuan kilau premium melintasi poster */}
                <span aria-hidden className="t3d-shine" />
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

        {/* ---- cara kerja ---- */}
        <section className="t3d-scene py-14 sm:py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#b8532f] dark:text-[#e59a7c]">
            Cara kerja · 4 langkah
          </p>
          <h2 className="t3d-text mt-3 max-w-md text-2xl font-extrabold tracking-tight text-[#3d3929] sm:text-3xl dark:text-[#f0eee4]">
            Dari file GPX ke dinding rumahmu.
          </h2>
          <div className="relative mt-10">
            {/* garis penghubung (desktop) — tumbuh saat masuk view */}
            <div aria-hidden className="absolute left-0 right-0 top-7 hidden lg:block">
              <div className="t3d-grow mx-[12%] h-0.5 rounded-full bg-gradient-to-r from-[#d97757]/50 via-[#c05d3d]/30 to-transparent" />
            </div>
            <ol className="relative grid grid-cols-2 gap-x-6 gap-y-9 lg:grid-cols-4">
              {[
                [<Upload key="i" size={18} />, "Kirim GPX + foto", "Lewat WhatsApp — jalur & momen pendakianmu."],
                [<Eye key="i" size={18} />, "Preview kamu setujui", "Kami rakit, kamu cek dulu. Revisi sampai cocok."],
                [<Boxes key="i" size={18} />, "Cetak + tempel 3D", "Poster 300 DPI, jalur dicetak 3D printer 1:1, ditempel satu-satu."],
                [<PackageCheck key="i" size={18} />, "Sampai di rumahmu", "Dikemas aman, dikirim ke seluruh Indonesia."],
              ].map(([icon, title, desc], i) => (
                <li key={title as string} className="t3d-reveal flex flex-col items-start">
                  <span className="t3d-coin relative flex h-14 w-14 items-center justify-center text-[#b8532f] dark:text-[#e59a7c]">
                    {icon}
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] font-mono text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---- isi poster ---- */}
        <section className="t3d-scene py-14 sm:py-20">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#b8532f] dark:text-[#e59a7c]">
            Isi poster · 8 detail
          </p>
          <h2 className="t3d-text mt-3 max-w-md text-2xl font-extrabold tracking-tight text-[#3d3929] sm:text-3xl dark:text-[#f0eee4]">
            Yang tercetak di postermu
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Setiap elemen dirangkai dari data pendakianmu sendiri — bukan template.
          </p>
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

        {/* ---- spotlight Summit Replay ---- */}
        <section className="t3d-scene relative py-14 sm:py-20">
          <div aria-hidden className="t3d-orb -right-28 top-10 h-72 w-72" />
          <div className="t3d-reveal grid grid-cols-1 items-center gap-10 lg:grid-cols-[6fr_5fr] lg:gap-14">
            <div>
              <p className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-[#b8532f] dark:text-[#e59a7c]">
                <QrCode size={13} /> Fitur unggulan · Summit Replay
              </p>
              <h2 className="t3d-text mt-4 max-w-md text-2xl font-extrabold tracking-tight text-[#3d3929] sm:text-3xl dark:text-[#f0eee4]">
                QR yang bikin postermu bergerak.
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400">
                Scan QR di poster, dan pendakianmu <strong className="font-semibold text-zinc-800 dark:text-zinc-200">diputar ulang</strong>: titikmu berjalan
                dari basecamp ke puncak di atas peta, profil elevasi ikut naik, dan
                jam berjalan sesuai waktu tempuh aslimu. Poster di dinding, kisahnya di layar.
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {[
                  ["Animasi dari data GPX-mu", "Bukan video generik — gerakannya persis jejak rekamanmu."],
                  ["Tinggal scan, langsung jalan", "Terbuka di HP siapa pun tanpa aplikasi. Cocok dipamerkan ke tamu."],
                  ["Single & koleksi", "Satu gunung, atau ekspedisi beberapa gunung yang diputar bergantian."],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-3">
                    <Check size={17} className="mt-0.5 shrink-0 text-[#c05d3d] dark:text-[#e59a7c]" />
                    <span className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
                      <strong className="font-semibold text-zinc-800 dark:text-zinc-100">{t}.</strong> {d}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={PESAN_HREF}
                className="t3d-btn mt-8 inline-flex items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-6 py-3 text-sm font-semibold text-white"
              >
                Pesan poster + Summit Replay
                <ArrowRight size={15} />
              </Link>
            </div>
            <div className="t3d-scene order-first lg:order-last">
              <ReplayScreen />
            </div>
          </div>
        </section>

        {/* ---- paket ---- */}
        <section className="t3d-scene relative pb-14 sm:pb-20">
          <div aria-hidden className="t3d-orb -left-24 bottom-0 h-64 w-64" />
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#b8532f] dark:text-[#e59a7c]">
            Harga · bayar setelah preview
          </p>
          <h2 className="t3d-text mt-3 text-2xl font-extrabold tracking-tight text-[#3d3929] sm:text-3xl dark:text-[#f0eee4]">
            Pilih paketmu
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
            Dua-duanya cetak tajam 300 DPI dengan jalur 3D timbul. Bedanya cuma
            di media pajang — pilih yang paling pas buat dindingmu.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-7 sm:grid-cols-2">
            {packages.map((p, i) => {
              const recommended = i === 1;
              return (
              <div key={p.id} className="t3d-reveal flex">
              <div
                className={`t3d-card ${i % 2 === 1 ? "t3d-card-r" : ""} relative flex w-full flex-col p-6 sm:p-7 ${
                  recommended ? "ring-2 ring-[#d97757] dark:ring-[#e59a7c]/70" : ""
                }`}
              >
                {recommended && (
                  <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-[#d97757] to-[#b8532f] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                    <Sparkles size={11} /> Paling direkomendasikan
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{p.name}</h3>
                  <span className="t3d-coin px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide">
                    {p.badge}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-baseline gap-x-2">
                  {p.strike && (
                    <span className="text-base font-semibold text-zinc-400 line-through decoration-[#c05d3d]/70 decoration-2 dark:text-zinc-500">
                      {p.strike}
                    </span>
                  )}
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
              );
            })}
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-[#c05d3d] dark:text-[#e59a7c]" /> Preview gratis dulu</span>
            <span className="flex items-center gap-1.5"><Check size={14} className="text-[#c05d3d] dark:text-[#e59a7c]" /> Revisi sampai cocok</span>
            <span className="flex items-center gap-1.5"><Hammer size={14} className="text-[#c05d3d] dark:text-[#e59a7c]" /> Dikerjakan satu-satu</span>
            <span className="flex items-center gap-1.5"><Truck size={14} className="text-[#c05d3d] dark:text-[#e59a7c]" /> Kirim se-Indonesia</span>
          </div>
          <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
            Belum punya file GPX? Tenang — bisa dibantu admin. Detailnya di halaman pesan.
          </p>
        </section>

        {/* ---- CTA penutup ---- */}
        <section className="t3d-scene pb-16 sm:pb-24">
          <div className="t3d-reveal t3d-card relative overflow-hidden p-8 text-center sm:p-12">
            <div aria-hidden className="t3d-orb -right-16 -top-10 h-52 w-52 opacity-70" />
            <div aria-hidden className="t3d-orb -left-16 bottom-0 h-44 w-44 opacity-60" />
            <span className="relative inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.22em] text-[#b8532f] dark:text-[#e59a7c]">
              <Mountain size={13} /> Satu jejak, satu karya
            </span>
            <h2 className="t3d-text relative mx-auto mt-3 max-w-lg text-2xl font-extrabold tracking-tight text-[#3d3929] sm:text-3xl dark:text-[#f0eee4]">
              Ubah pendakianmu jadi poster yang bercerita.
            </h2>
            <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Kirim GPX-mu sekarang. Lihat previewnya dulu — bayar hanya kalau kamu suka.
            </p>
            <div className="relative mt-7 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={PESAN_HREF}
                className="t3d-btn inline-flex items-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-7 py-3.5 text-sm font-semibold text-white"
              >
                Mulai pesan sekarang
                <ArrowRight size={15} />
              </Link>
              <a
                href={`https://wa.me/${WA_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="clay-chip inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200"
              >
                <MessageCircle size={15} /> Tanya admin dulu
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200/70 dark:border-zinc-800/70">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white">
              <Mountain size={14} />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">myKoordinat</p>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Poster pendakian custom dari file GPX</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            <Link href={PESAN_HREF} className="transition-colors hover:text-[#b8532f] dark:hover:text-[#e59a7c]">
              Pesan
            </Link>
            <a
              href={`https://wa.me/${WA_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-[#b8532f] dark:hover:text-[#e59a7c]"
            >
              <MessageCircle size={13} /> {WA_NUMBER.replace(/^62/, "0")}
            </a>
            <span className="flex items-center gap-1.5">
              <AtSign size={13} /> myKoordinat
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
