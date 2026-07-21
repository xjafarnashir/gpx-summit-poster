"use client";

import { useState } from "react";
import { ArrowUpRight, Check, MessageCircle, Plus, Trash2 } from "lucide-react";
import { WA_NUMBER, type PackageId, type PosterPackage } from "@/lib/landing";
import { applyPricing } from "@/lib/pricing";
import { usePricing } from "@/lib/usePricing";
import { BACKGROUND_THEMES, bgThemeById, type BackgroundThemeId } from "@/lib/backgroundThemes";
import { ORDER_JSON_LABEL, type OrderPayload, type OrderShipping } from "@/lib/orderPayload";

/* ============================================================================
 * Bagian PESAN di landing page: pilih jenis (1 pendakian / koleksi 2-3 gunung),
 * isi data → PREVIEW LIVE (SVG ringan) update seketika → tombol WhatsApp dengan
 * SELURUH data sudah terangkai. Foto + file GPX menyusul di chat (setelah DP).
 * Tidak menyimpan apa pun di server.
 * ========================================================================== */

type Mode = "single" | "collection";

interface SingleForm {
  nama: string;
  gunung: string;
  via: string;
  tanggal: string;
  ketinggian: string;
  jarak: string;
  elevGain: string;
  waktu: string;
  instagram: string;
  tiktok: string;
  linkQr: string;
  catatan: string;
}

interface HikeForm {
  gunung: string;
  via: string;
  tanggal: string;
  ketinggian: string;
  jarak: string;
  elevGain: string;
  waktu: string;
}

interface CollectionForm {
  judul: string;
  namaPendaki: string;
  deskripsi: string;
  instagram: string;
  tiktok: string;
  linkQr: string;
  catatan: string;
  hikes: HikeForm[];
}

const EMPTY_SINGLE: SingleForm = {
  nama: "",
  gunung: "",
  via: "",
  tanggal: "",
  ketinggian: "",
  jarak: "",
  elevGain: "",
  waktu: "",
  instagram: "",
  tiktok: "",
  linkQr: "",
  catatan: "",
};

const emptyHike = (): HikeForm => ({ gunung: "", via: "", tanggal: "", ketinggian: "", jarak: "", elevGain: "", waktu: "" });

const EMPTY_COLLECTION: CollectionForm = {
  judul: "",
  namaPendaki: "",
  deskripsi: "",
  instagram: "",
  tiktok: "",
  linkQr: "",
  catatan: "",
  hikes: [emptyHike(), emptyHike()],
};

const EMPTY_SHIPPING: OrderShipping = { penerima: "", hp: "", alamat: "" };

const num = (s: string): number => {
  const n = parseFloat(s.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/* ------------------------------- WA builders ------------------------------ */

const waUrl = (text: string) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

/** Baris alamat pengiriman (dibaca admin) — sama untuk single & koleksi. */
function shippingLines(s: OrderShipping): string[] {
  return [
    "",
    "Pengiriman ke:",
    `- Penerima: ${s.penerima.trim()}`,
    `- No HP: ${s.hp.trim()}`,
    `- Alamat: ${s.alamat.trim()}`,
  ];
}

/** Blok kode pesanan: JSON satu baris yang di-paste admin ke /editor. */
function orderJsonBlock(payload: OrderPayload): string[] {
  return ["", ORDER_JSON_LABEL, JSON.stringify(payload)];
}

function buildMsgSingle(pkg: PosterPackage, bgId: BackgroundThemeId, bgLabel: string, f: SingleForm, ship: OrderShipping): string {
  const lines = [
    `Halo! Saya mau pesan *Poster Pendakian 20x30 cm landscape + jalur 3D timbul*.`,
    `Paket: *${pkg.name}* — ${pkg.mount} (${pkg.price})`,
    `Tema latar: ${bgLabel}`,
    "",
    "Data poster:",
    `- Nama: ${f.nama.trim()}`,
    `- Gunung: ${f.gunung.trim()}`,
  ];
  const add = (label: string, v: string) => v.trim() && lines.push(`- ${label}: ${v.trim()}`);
  add("Via/Jalur", f.via);
  add("Tanggal", f.tanggal);
  add("Ketinggian (mdpl)", f.ketinggian);
  add("Jarak (km)", f.jarak);
  add("Elevation gain (m)", f.elevGain);
  add("Waktu tempuh", f.waktu);
  add("Instagram", f.instagram);
  add("TikTok", f.tiktok);
  add("Link QR", f.linkQr);
  add("Catatan", f.catatan);
  lines.push(...shippingLines(ship));
  lines.push("", "File GPX + foto pendakian saya kirim di chat ini ya.");
  const payload: OrderPayload = {
    v: 1,
    jenis: "single",
    paket: pkg.id,
    tema: bgId,
    nama: f.nama.trim(),
    gunung: f.gunung.trim(),
    via: f.via.trim(),
    tanggal: f.tanggal.trim(),
    mdpl: f.ketinggian.trim(),
    km: f.jarak.trim(),
    gain: f.elevGain.trim(),
    waktu: f.waktu.trim(),
    ig: f.instagram.trim(),
    tt: f.tiktok.trim(),
    qr: f.linkQr.trim(),
    catatan: f.catatan.trim(),
    kirim: { penerima: ship.penerima.trim(), hp: ship.hp.trim(), alamat: ship.alamat.trim() },
  };
  lines.push(...orderJsonBlock(payload));
  return lines.join("\n");
}

function buildMsgCollection(pkg: PosterPackage, bgId: BackgroundThemeId, bgLabel: string, f: CollectionForm, ship: OrderShipping): string {
  const lines = [
    `Halo! Saya mau pesan *Poster Koleksi Ekspedisi (${f.hikes.length} gunung) 20x30 cm + jalur 3D timbul*.`,
    `Paket: *${pkg.name}* — ${pkg.mount} (${pkg.price})`,
    `Tema latar: ${bgLabel}`,
    "",
    "Data ekspedisi:",
    `- Judul: ${f.judul.trim()}`,
    `- Nama pendaki: ${f.namaPendaki.trim()}`,
  ];
  const add = (label: string, v: string) => v.trim() && lines.push(`- ${label}: ${v.trim()}`);
  add("Deskripsi", f.deskripsi);
  add("Instagram", f.instagram);
  add("TikTok", f.tiktok);
  add("Link QR", f.linkQr);
  add("Catatan", f.catatan);
  f.hikes.forEach((h, i) => {
    lines.push("", `Gunung ${i + 1}:`, `- Gunung: ${h.gunung.trim()}`);
    const addH = (label: string, v: string) => v.trim() && lines.push(`- ${label}: ${v.trim()}`);
    addH("Via/Jalur", h.via);
    addH("Tanggal", h.tanggal);
    addH("Ketinggian (mdpl)", h.ketinggian);
    addH("Jarak (km)", h.jarak);
    addH("Elevation gain (m)", h.elevGain);
    addH("Waktu tempuh", h.waktu);
  });
  lines.push(...shippingLines(ship));
  lines.push("", "File GPX tiap gunung + foto saya kirim di chat ini ya.");
  const payload: OrderPayload = {
    v: 1,
    jenis: "koleksi",
    paket: pkg.id,
    tema: bgId,
    judul: f.judul.trim(),
    pendaki: f.namaPendaki.trim(),
    deskripsi: f.deskripsi.trim(),
    ig: f.instagram.trim(),
    tt: f.tiktok.trim(),
    qr: f.linkQr.trim(),
    catatan: f.catatan.trim(),
    kirim: { penerima: ship.penerima.trim(), hp: ship.hp.trim(), alamat: ship.alamat.trim() },
    gunung: f.hikes.map((h) => ({
      nama: h.gunung.trim(),
      via: h.via.trim(),
      tanggal: h.tanggal.trim(),
      mdpl: h.ketinggian.trim(),
      km: h.jarak.trim(),
      gain: h.elevGain.trim(),
      waktu: h.waktu.trim(),
    })),
  };
  lines.push(...orderJsonBlock(payload));
  return lines.join("\n");
}

/* ------------------------------- Preview SVG ------------------------------ */

const SKY = "url(#lo-sky)";

function Defs({ stops }: { stops: [number, string][] }) {
  return (
    <defs>
      <linearGradient id="lo-sky" x1="0" y1="0" x2="0" y2="1">
        {stops.map(([o, c]) => (
          <stop key={o} offset={o} stopColor={c} />
        ))}
      </linearGradient>
      <linearGradient id="lo-map" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4c4f52" />
        <stop offset="1" stopColor="#6d5a40" />
      </linearGradient>
    </defs>
  );
}

const up = (s: string, fb = "") => (s.trim() ? s.trim().toUpperCase() : fb);

/**
 * Potong teks (dengan …) agar muat `maxUnits` (unit viewBox) pada `fontPx`,
 * supaya tidak pernah keluar batas blok. Diukur via canvas — proporsional
 * dengan SVG karena viewBox diskalakan seragam. SSR (tanpa document) mengembalikan
 * teks apa adanya (aman: placeholder pendek).
 */
let _measureCanvas: HTMLCanvasElement | null = null;
function fit(text: string, fontPx: number, maxUnits: number, opts?: { weight?: string; mono?: boolean }): string {
  if (typeof document === "undefined" || !text) return text;
  _measureCanvas ??= document.createElement("canvas");
  const ctx = _measureCanvas.getContext("2d");
  if (!ctx) return text;
  ctx.font = `${opts?.weight ?? "400"} ${fontPx}px ${opts?.mono ? "monospace" : "sans-serif"}`;
  if (ctx.measureText(text).width <= maxUnits) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxUnits) t = t.slice(0, -1);
  return t + "…";
}

/** Ikon hiker mini (bentuk sama dengan poster editor), untuk depan nama pendaki. */
function HikerGlyph({ x, y, size, color = "#ffcf8a" }: { x: number; y: number; size: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${size / 24}) translate(24,0) scale(-1,1)`}>
      <g fill={color}>
        <circle cx="11.4" cy="3.9" r="2.05" />
        <rect x="6.4" y="6.2" width="3.9" height="5.9" rx="1.7" transform="rotate(9 8.35 9.15)" />
        <rect x="9.5" y="5.8" width="3.2" height="7.1" rx="1.6" transform="rotate(11 11.1 9.35)" />
        <rect x="8.2" y="12" width="2.3" height="6.6" rx="1.15" transform="rotate(24 9.35 15.3)" />
        <rect x="11.3" y="12.2" width="2.3" height="6.9" rx="1.15" transform="rotate(-13 12.45 15.65)" />
        <rect x="10.7" y="6.5" width="4.9" height="2" rx="1" transform="rotate(24 13.15 7.5)" />
      </g>
      <line x1="15.6" y1="8.7" x2="17.8" y2="20.6" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
    </g>
  );
}

/** Kotak QR putih (posisi sama dengan poster). */
function QrBox({ x, y, size }: { x: number; y: number; size: number }) {
  const u = size / 7;
  const d = (cx: number, cy: number, w = 1, h = 1) => (
    <rect x={x + cx * u} y={y + cy * u} width={w * u} height={h * u} fill="#1c1740" />
  );
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} rx={size * 0.09} fill="#fff" />
      {d(0.6, 0.6, 1.7, 1.7)}
      <rect x={x + u} y={y + u} width={0.9 * u} height={0.9 * u} fill="#fff" />
      {d(4.7, 0.6, 1.7, 1.7)}
      <rect x={x + 5.1 * u} y={y + u} width={0.9 * u} height={0.9 * u} fill="#fff" />
      {d(0.6, 4.7, 1.7, 1.7)}
      <rect x={x + u} y={y + 5.1 * u} width={0.9 * u} height={0.9 * u} fill="#fff" />
      {d(3, 3)}{d(4.2, 4)}{d(5.3, 5.3, 0.8, 0.8)}{d(3.4, 5.4, 0.8, 0.8)}{d(5.4, 3.2, 0.8, 0.8)}
    </g>
  );
}

/** Nama pendaki + ikon hiker, terpusat di (cx, baseY) — meniru poster. */
function ClimberLine({ cx, baseY, name, fs, iconSize }: { cx: number; baseY: number; name: string; fs: number; iconSize: number }) {
  const textW = name.length * fs * 0.56;
  const groupW = iconSize + 4 + textW;
  const startX = cx - groupW / 2;
  return (
    <g>
      <HikerGlyph x={startX} y={baseY - iconSize * 0.84} size={iconSize} />
      <text x={startX + iconSize + 4} y={baseY} fontFamily="sans-serif" fontSize={fs} fontWeight="800" fill="#fbf5ea">{name}</text>
    </g>
  );
}

function SinglePreview({ f, stops }: { f: SingleForm; stops: [number, string][] }) {
  const hasQr = f.linkQr.trim().length > 0;
  const meta = [f.nama.trim() || "Nama pendaki", f.tanggal.trim()].filter(Boolean).join("   ·   ");
  const socials = [f.instagram.trim() && `IG ${f.instagram.trim()}`, f.tiktok.trim() && `TT ${f.tiktok.trim()}`].filter(Boolean).join("   ·   ");
  return (
    <svg viewBox="0 0 660 440" className="h-auto w-full" role="img" aria-label="Preview poster">
      <Defs stops={stops} />
      <rect width="660" height="440" fill={SKY} />
      <rect x="16" y="16" width="628" height="408" fill="none" stroke="rgba(251,245,234,0.28)" strokeWidth="0.9" />

      {/* kolom kiri: peta (placeholder) + rute contoh + strip elevasi */}
      <rect x="30" y="34" width="268" height="332" rx="6" fill="url(#lo-map)" />
      <path d="M78,344 C100,300 84,266 110,222 C136,180 114,148 146,108 C166,82 156,64 176,46" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="8" strokeLinecap="round" transform="translate(2,2)" />
      <path d="M78,344 C100,300 84,266 110,222 C136,180 114,148 146,108 C166,82 156,64 176,46" fill="none" stroke="#d6381d" strokeWidth="6" strokeLinecap="round" />
      <circle cx="78" cy="344" r="6" fill="#fff" /><circle cx="78" cy="344" r="3.6" fill="#38bdf8" />
      <circle cx="176" cy="46" r="6.5" fill="#fff" /><circle cx="176" cy="46" r="4" fill="#d6381d" />
      <rect x="40" y="344" width="140" height="16" rx="3" fill="rgba(12,9,22,0.6)" />
      <text x="46" y="355.5" fontFamily="monospace" fontSize="8.5" letterSpacing="0.5" fill="#ffcf8a">PETA DARI GPX-MU</text>
      <rect x="30" y="372" width="268" height="34" rx="4" fill="rgba(15,10,26,0.5)" stroke="rgba(251,245,234,0.14)" strokeWidth="0.6" />
      <text x="42" y="386" fontFamily="monospace" fontSize="8" letterSpacing="1.5" fill="#ffcf8a">PROFIL ELEVASI</text>
      <path d="M40,400 L80,394 L120,396 L160,384 L210,380 L260,388 L288,398" fill="none" stroke="#fbf5ea" strokeWidth="1.4" />

      {/* kolom kanan */}
      <rect x="322" y="42" width="20" height="13" fill="#e70011" /><rect x="322" y="48.5" width="20" height="6.5" fill="#fff" />
      <text x="350" y="53" fontFamily="monospace" fontSize="10" letterSpacing="2.5" fill="rgba(251,245,234,0.8)">RUTE PENDAKIAN</text>
      <text x="322" y="100" fontFamily="sans-serif" fontSize="36" fontWeight="800" fill="#fbf5ea">{fit(up(f.gunung, "GUNUNG"), 36, 310, { weight: "800" })}</text>
      <rect x="322" y="112" width="86" height="4" fill="#ffcf8a" />
      <text x="322" y="138" fontFamily="sans-serif" fontSize="13" fontWeight="700" letterSpacing="1.5" fill="rgba(251,245,234,0.82)">{fit(`VIA ${up(f.via, "JALUR")}`, 13, hasQr ? 248 : 310, { weight: "700" })}</text>

      {/* QR kanan-atas (sejajar VIA, seperti poster) */}
      {hasQr && <QrBox x={576} y={120} size={58} />}

      {/* meta: nama · tanggal, lalu sosmed */}
      <text x="322" y="166" fontFamily="sans-serif" fontSize="12" fontWeight="600" fill="rgba(251,245,234,0.85)">{fit(meta, 12, hasQr ? 248 : 310, { weight: "600" })}</text>
      {socials && <text x="322" y="184" fontFamily="sans-serif" fontSize="11" fill="rgba(251,245,234,0.7)">{fit(socials, 11, 310)}</text>}

      {/* stat row editorial (dasar kolom kanan) */}
      <line x1="322" y1="212" x2="632" y2="212" stroke="rgba(251,245,234,0.22)" strokeWidth="0.8" />
      <rect x="322" y="210.5" width="42" height="3" fill="#ffcf8a" />
      <g fontFamily="monospace" fontSize="8.5" letterSpacing="1" fill="#ffcf8a">
        <text x="322" y="230">KETINGGIAN</text>
        <text x="402" y="230">JARAK</text>
        <text x="470" y="230">ELEV GAIN</text>
        <text x="556" y="230">WAKTU</text>
      </g>
      <g fontFamily="sans-serif" fontSize="19" fontWeight="800" fill="#fbf5ea">
        <text x="322" y="254">{fit(f.ketinggian.trim() || "0", 19, 58, { weight: "800" })}<tspan fontSize="9" fontWeight="600" fill="rgba(251,245,234,0.7)"> MDPL</tspan></text>
        <text x="402" y="254">{fit(f.jarak.trim() || "0", 19, 46, { weight: "800" })}<tspan fontSize="9" fontWeight="600" fill="rgba(251,245,234,0.7)"> KM</tspan></text>
        <text x="470" y="254">{fit(f.elevGain.trim() ? `+${f.elevGain.trim()}` : "+0", 19, 68, { weight: "800" })}<tspan fontSize="9" fontWeight="600" fill="rgba(251,245,234,0.7)"> M</tspan></text>
        <text x="556" y="254" fontSize="14">{fit(f.waktu.trim() || "—", 14, 74, { weight: "800" })}</text>
      </g>

      {/* foto (kolom kanan bawah) */}
      <rect x="322" y="272" width="150" height="122" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(251,245,234,0.25)" strokeWidth="0.8" />
      <rect x="482" y="272" width="150" height="122" rx="6" fill="rgba(255,255,255,0.06)" stroke="rgba(251,245,234,0.25)" strokeWidth="0.8" />
      <text x="397" y="337" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="rgba(251,245,234,0.5)">FOTO</text>
      <text x="557" y="337" textAnchor="middle" fontFamily="monospace" fontSize="10" fill="rgba(251,245,234,0.5)">FOTO</text>
    </svg>
  );
}

function CollectionPreview({ f, stops }: { f: CollectionForm; stops: [number, string][] }) {
  const n = f.hikes.length;
  const innerX = 33;
  const innerW = 594;
  const gap = innerW * 0.035;
  const blockW = (innerW - gap * (n - 1)) / n;
  const cx = 330;
  const hasQr = f.linkQr.trim().length > 0;
  // Lebar aman teks tengah blok ekspedisi (menyempit saat ada QR di kanan).
  const bandW = hasQr ? 470 : 590;

  const totalKet = f.hikes.reduce((s, h) => s + num(h.ketinggian), 0);
  const totalJarak = f.hikes.reduce((s, h) => s + num(h.jarak), 0);
  const totalGain = f.hikes.reduce((s, h) => s + num(h.elevGain), 0);

  const mountains = f.hikes.map((h) => up(h.gunung, "GUNUNG")).join("    ·    ");
  const dateBits = f.hikes
    .filter((h) => h.tanggal.trim())
    .map((h) => `${(h.gunung.trim().split(" ").pop() || "GUNUNG").toUpperCase()} ${h.tanggal.trim().toUpperCase()}`)
    .join("   |   ");
  const socials = [f.instagram.trim() && `IG ${f.instagram.trim()}`, f.tiktok.trim() && `TT ${f.tiktok.trim()}`].filter(Boolean).join("   ·   ");

  // Pre-calculate uniform mountain name font size so none get truncated in the preview
  let minNameFontSize = 16;
  if (typeof document !== "undefined") {
    _measureCanvas ??= document.createElement("canvas");
    const testCtx = _measureCanvas.getContext("2d");
    if (testCtx) {
      f.hikes.forEach((h, i) => {
        const bx = innerX + i * (blockW + gap);
        const pad = blockW * 0.05;
        const mapW = (blockW - pad * 2) * 0.47;
        const rx = bx + pad + mapW + (blockW - pad * 2) * 0.07;
        const rw = bx + blockW - pad - rx;
        const nameText = up(h.gunung, `GUNUNG ${i + 1}`);

        let fs = 16;
        testCtx.font = `800 ${fs}px sans-serif`;
        while (testCtx.measureText(nameText).width > rw && fs > 6) {
          fs -= 0.5;
          testCtx.font = `800 ${fs}px sans-serif`;
        }
        if (fs < minNameFontSize) {
          minNameFontSize = fs;
        }
      });
    }
  }

  return (
    <svg viewBox="0 0 660 440" className="h-auto w-full" role="img" aria-label="Preview poster koleksi">
      <Defs stops={stops} />
      <rect width="660" height="440" fill={SKY} />
      <rect x="14" y="14" width="632" height="412" fill="none" stroke="rgba(251,245,234,0.28)" strokeWidth="0.9" />

      {/* blok gunung (kartu): peta kiri, kanan nama/stat + foto (dasar foto = dasar peta) */}
      {f.hikes.map((h, i) => {
        const bx = innerX + i * (blockW + gap);
        const pad = blockW * 0.05;
        const mapW = (blockW - pad * 2) * 0.47;
        const rx = bx + pad + mapW + (blockW - pad * 2) * 0.07;
        const rw = bx + blockW - pad - rx;
        return (
          <g key={i}>
            <rect x={bx} y={38} width={blockW} height={228} rx={6} fill="rgba(12,9,24,0.32)" stroke="rgba(251,245,234,0.14)" strokeWidth="0.8" />
            <rect x={bx + pad} y={44} width={mapW} height={216} rx={4} fill="url(#lo-map)" />
            <path d={`M${bx + pad + mapW * 0.45},252 C${bx + pad + mapW * 0.7},210 ${bx + pad + mapW * 0.4},170 ${bx + pad + mapW * 0.6},116 C${bx + pad + mapW * 0.78},74 ${bx + pad + mapW * 0.5},62 ${bx + pad + mapW * 0.62},50`} fill="none" stroke="#d6381d" strokeWidth="4.5" strokeLinecap="round" />
            <text x={rx} y={66} fontFamily="monospace" fontSize="8" letterSpacing="1" fill="rgba(251,245,234,0.6)">PENDAKIAN</text>
            <text x={rx} y={86} fontFamily="sans-serif" fontSize={minNameFontSize} fontWeight="800" fill="#fbf5ea">{up(h.gunung, `GUNUNG ${i + 1}`)}</text>
            <text x={rx} y={100} fontFamily="monospace" fontSize="8" fill="#ffcf8a">{fit(`VIA ${up(h.via, "JALUR")}`, 8, rw, { mono: true })}</text>
            <text x={rx} y={128} fontFamily="sans-serif" fontSize="17" fontWeight="800" fill="#fbf5ea">{fit(h.ketinggian.trim() || "0", 17, rw * 0.62, { weight: "800" })}<tspan fontSize="9" fill="rgba(251,245,234,0.7)"> MDPL</tspan></text>
            <text x={rx} y={144} fontFamily="monospace" fontSize="8.5" fill="rgba(251,245,234,0.75)">{fit(`${h.jarak.trim() || "0"} KM · +${h.elevGain.trim() || "0"} M`, 8.5, rw, { mono: true })}</text>
            <rect x={rx} y={156} width={rw} height={104} rx={4} fill="rgba(255,255,255,0.06)" stroke="rgba(251,245,234,0.22)" strokeWidth="0.7" />
            <text x={rx + rw / 2} y={210} textAnchor="middle" fontFamily="monospace" fontSize="8.5" fill="rgba(251,245,234,0.5)">FOTO</text>
          </g>
        );
      })}

      {/* blok ekspedisi (stack tengah, urutan sama dengan poster) */}
      <line x1="33" y1="278" x2="627" y2="278" stroke="rgba(251,245,234,0.22)" strokeWidth="0.9" />
      {hasQr && <QrBox x={571} y={285} size={52} />}
      <text x={cx} y="303" textAnchor="middle" fontFamily="sans-serif" fontSize="22" fontWeight="800" fill="#fbf5ea">{fit(up(f.judul, "JUDUL EKSPEDISI"), 22, bandW, { weight: "800" })}</text>
      <rect x={cx - 45} y="308" width="90" height="3" fill="#ffcf8a" />
      <text x={cx} y="322" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" letterSpacing="0.5" fill="rgba(251,245,234,0.82)">{fit(mountains, 9, bandW, { weight: "600" })}</text>
      <ClimberLine cx={cx} baseY={335} name={fit(f.namaPendaki.trim() || "Nama pendaki", 10, bandW - 20, { weight: "800" })} fs={10} iconSize={13} />
      {dateBits && <text x={cx} y="347" textAnchor="middle" fontFamily="monospace" fontSize="8" letterSpacing="0.3" fill="rgba(251,245,234,0.6)">{fit(dateBits, 8, bandW, { mono: true })}</text>}
      {socials && <text x={cx} y="358" textAnchor="middle" fontFamily="sans-serif" fontSize="9" fontWeight="600" fill="rgba(251,245,234,0.8)">{fit(socials, 9, bandW, { weight: "600" })}</text>}
      {f.deskripsi.trim() && <text x={cx} y="370" textAnchor="middle" fontFamily="sans-serif" fontSize="8" fontStyle="italic" fill="rgba(251,245,234,0.72)">&ldquo;{fit(f.deskripsi.trim(), 8, bandW * 0.92)}&rdquo;</text>}

      {/* baris total: garis + tick emas, 3 kolom terpusat */}
      <line x1="33" y1="384" x2="627" y2="384" stroke="rgba(251,245,234,0.22)" strokeWidth="0.8" />
      <rect x="33" y="382.5" width="72" height="3" fill="#ffcf8a" />
      <g fontFamily="monospace" fontSize="8.5" fill="#ffcf8a">
        <text x="132" y="399" textAnchor="middle">TOTAL KETINGGIAN</text>
        <text x="330" y="399" textAnchor="middle">TOTAL JARAK</text>
        <text x="528" y="399" textAnchor="middle">TOTAL ELEV GAIN</text>
      </g>
      <g fontFamily="sans-serif" fontWeight="800" fontSize="17" fill="#fbf5ea">
        <text x="132" y="417" textAnchor="middle">{Math.round(totalKet).toLocaleString("id-ID")}<tspan fontSize="9" fontWeight="600" fill="rgba(251,245,234,0.7)"> MDPL</tspan></text>
        <text x="330" y="417" textAnchor="middle">{totalJarak.toFixed(2)}<tspan fontSize="9" fontWeight="600" fill="rgba(251,245,234,0.7)"> KM</tspan></text>
        <text x="528" y="417" textAnchor="middle">+{Math.round(totalGain)}<tspan fontSize="9" fontWeight="600" fill="rgba(251,245,234,0.7)"> M</tspan></text>
      </g>
    </svg>
  );
}

/* --------------------------------- UI ------------------------------------- */

const inputClass =
  "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600";
const labelClass = "block text-xs font-medium text-zinc-600 dark:text-zinc-300";

function Field({ label, opt, ...props }: { label: string; opt?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={labelClass}>
      {label} {opt && <span className="font-normal text-zinc-400">(opsional)</span>}
      <input className={inputClass} {...props} />
    </label>
  );
}

function PackageSelector({
  packages,
  pkgId,
  onPick,
  error,
}: {
  packages: PosterPackage[];
  pkgId: PackageId | null;
  onPick: (id: PackageId) => void;
  error: boolean;
}) {
  return (
    <div id="lo-paket" className="scroll-mt-24">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Pilih paket <span className="text-[#c05d3d]">*</span>
        </span>
        {error && <span className="text-xs font-medium text-red-500">Pilih dulu paketnya ya</span>}
      </div>
      <div className={`mt-2 grid grid-cols-1 gap-3 rounded-2xl ${error ? "ring-2 ring-red-400/70" : ""}`}>
        {packages.map((p) => {
          const active = pkgId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.id)}
              className={`clay-tile relative p-4 text-left transition-colors ${active ? "border-[#d97757]" : "border-transparent"}`}
            >
              <span className="absolute right-3 top-3 rounded-full bg-[#f7e9e1] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-[#9c4a2c] dark:bg-[#3a2a22] dark:text-[#e59a7c]">
                {p.badge}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    active ? "border-[#d97757] bg-[#d97757] text-white" : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  {active && <Check size={11} strokeWidth={3} />}
                </span>
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{p.name}</span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
                {p.strike && (
                  <span className="text-sm font-semibold text-zinc-400 line-through decoration-[#c05d3d]/70 dark:text-zinc-500">
                    {p.strike}
                  </span>
                )}
                <span className="text-lg font-extrabold text-[#b8532f] dark:text-[#e59a7c]">{p.price}</span>
              </div>
              <div className="mt-0.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">{p.mount}</div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500">{p.tagline}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LandingOrder() {
  const [pkgId, setPkgId] = useState<PackageId | null>(null);
  const [pkgError, setPkgError] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [single, setSingle] = useState<SingleForm>(EMPTY_SINGLE);
  const [collection, setCollection] = useState<CollectionForm>(EMPTY_COLLECTION);
  const [shipping, setShipping] = useState<OrderShipping>(EMPTY_SHIPPING);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
  // Tema latar WAJIB dipilih customer (tanpa default) — null = belum pilih.
  const [bgTheme, setBgTheme] = useState<BackgroundThemeId | null>(null);
  const [bgError, setBgError] = useState(false);
  // Harga terkini dari server (bisa disetel admin di /editor).
  const pricing = usePricing();
  const packages = applyPricing(pricing);
  const pkg = pkgId ? (packages.find((p) => p.id === pkgId) ?? null) : null;
  // Preview memakai sunset sebagai tampilan netral sebelum customer memilih.
  const bg = bgThemeById(bgTheme ?? "sunset");

  const patchS = (p: Partial<SingleForm>) => setSingle((f) => ({ ...f, ...p }));
  const patchC = (p: Partial<CollectionForm>) => setCollection((f) => ({ ...f, ...p }));
  const patchShip = (p: Partial<OrderShipping>) => setShipping((s) => ({ ...s, ...p }));
  const patchHike = (i: number, p: Partial<HikeForm>) =>
    setCollection((f) => ({ ...f, hikes: f.hikes.map((h, j) => (j === i ? { ...h, ...p } : h)) }));
  const addHike = () => setCollection((f) => (f.hikes.length >= 3 ? f : { ...f, hikes: [...f.hikes, emptyHike()] }));
  const removeHike = (i: number) =>
    setCollection((f) => (f.hikes.length <= 2 ? f : { ...f, hikes: f.hikes.filter((_, j) => j !== i) }));

  const pickPkg = (id: PackageId) => {
    setPkgId(id);
    setPkgError(false);
  };

  const pickTheme = (id: BackgroundThemeId) => {
    setBgTheme(id);
    setBgError(false);
  };

  // Klik "Lanjut" → validasi paket & tema → KONFIRMASI isi pesan (bukan langsung
  // buka WA), supaya calon customer bisa cek/koreksi dulu. Field teks wajib
  // ditegakkan native `required` sebelum handler ini jalan.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkg) {
      setPkgError(true);
      document.getElementById("lo-paket")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!bgTheme) {
      setBgError(true);
      document.getElementById("lo-tema")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setConfirmMsg(
      mode === "single"
        ? buildMsgSingle(pkg, bgTheme, bg.label, single, shipping)
        : buildMsgCollection(pkg, bgTheme, bg.label, collection, shipping)
    );
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h2 className="text-2xl font-extrabold tracking-tight text-[#3d3929] dark:text-[#f0eee4]">Pesan postermu</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
        Isi data → lihat previewnya langsung → lanjut ke WhatsApp dengan semua data
        sudah terangkai rapi. File GPX dan foto menyusul di chat (setelah DP).
      </p>

      {/* toggle jenis */}
      <div className="clay-well mt-5 inline-flex gap-1 p-1">
        {(["single", "collection"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              mode === m
                ? "bg-gradient-to-r from-[#d97757] to-[#b8532f] text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
            }`}
          >
            {m === "single" ? "1 Pendakian" : "Koleksi 2-3 Gunung"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="t3d-card overflow-hidden !rounded-xl p-2">
            <div className="overflow-hidden rounded-lg">
              {mode === "single" ? <SinglePreview f={single} stops={bg.stops} /> : <CollectionPreview f={collection} stops={bg.stops} />}
            </div>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            Preview langsung · {pkg ? pkg.name : "pilih paket"} · 20x30 cm
          </p>

          {/* tema latar — WAJIB dipilih */}
          <div id="lo-tema" className="mt-4 scroll-mt-24">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Tema latar <span className="text-[#c05d3d]">*</span>
              </span>
              {bgError && <span className="text-xs font-medium text-red-500">Pilih dulu temanya ya</span>}
            </div>
            <div className={`mt-2 grid grid-cols-4 gap-2 rounded-2xl ${bgError ? "ring-2 ring-red-400/70" : ""}`}>
              {BACKGROUND_THEMES.map((bt) => (
                <button
                  key={bt.id}
                  type="button"
                  onClick={() => pickTheme(bt.id)}
                  className={`clay-tile flex flex-col items-center gap-1 px-1 py-2 text-center text-[11px] font-medium transition-colors ${
                    bgTheme === bt.id
                      ? "border-[#d97757] text-[#9c4a2c] dark:border-[#d97757] dark:text-[#e59a7c]"
                      : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  }`}
                >
                  <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: bt.css }} />
                  {bt.label}
                </button>
              ))}
            </div>
          </div>

          {/* pilih paket — di bawah preview, wajib */}
          <div className="mt-5">
            <PackageSelector packages={packages} pkgId={pkgId} onPick={pickPkg} error={pkgError} />
          </div>
        </div>

        {/* form */}
        <form onSubmit={submit} className="flex flex-col gap-4">
          {mode === "single" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nama di poster" required placeholder="Nama kamu / tim" value={single.nama} onChange={(e) => patchS({ nama: e.target.value })} />
                <Field label="Gunung" required placeholder="Gunung Prau" value={single.gunung} onChange={(e) => patchS({ gunung: e.target.value })} />
                <Field label="Via / jalur" required placeholder="Patak Banteng" value={single.via} onChange={(e) => patchS({ via: e.target.value })} />
                <Field label="Tanggal" required placeholder="2 Juli 2026" value={single.tanggal} onChange={(e) => patchS({ tanggal: e.target.value })} />
                <Field label="Ketinggian (mdpl)" required inputMode="numeric" placeholder="2565" value={single.ketinggian} onChange={(e) => patchS({ ketinggian: e.target.value })} />
                <Field label="Jarak (km)" required inputMode="decimal" placeholder="8.5" value={single.jarak} onChange={(e) => patchS({ jarak: e.target.value })} />
                <Field label="Elevation gain (m)" required inputMode="numeric" placeholder="1200" value={single.elevGain} onChange={(e) => patchS({ elevGain: e.target.value })} />
                <Field label="Waktu tempuh" required placeholder="05:10:00" value={single.waktu} onChange={(e) => patchS({ waktu: e.target.value })} />
                <Field label="Instagram" opt placeholder="@handle" value={single.instagram} onChange={(e) => patchS({ instagram: e.target.value })} />
                <Field label="TikTok" opt placeholder="@handle" value={single.tiktok} onChange={(e) => patchS({ tiktok: e.target.value })} />
              </div>
              <Field label="Link QR code" opt placeholder="strava.com / linktr.ee / ..." value={single.linkQr} onChange={(e) => patchS({ linkQr: e.target.value })} />
              <label className={labelClass}>
                Catatan <span className="font-normal text-zinc-400">(opsional)</span>
                <textarea rows={2} className={inputClass} placeholder="Permintaan khusus: warna jalur, nama pos, dll." value={single.catatan} onChange={(e) => patchS({ catatan: e.target.value })} />
              </label>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Judul ekspedisi" required placeholder="Ekspedisi Triple-S" value={collection.judul} onChange={(e) => patchC({ judul: e.target.value })} />
                <Field label="Nama pendaki" required placeholder="Nama kamu / tim" value={collection.namaPendaki} onChange={(e) => patchC({ namaPendaki: e.target.value })} />
                <Field label="Instagram" opt placeholder="@handle" value={collection.instagram} onChange={(e) => patchC({ instagram: e.target.value })} />
                <Field label="TikTok" opt placeholder="@handle" value={collection.tiktok} onChange={(e) => patchC({ tiktok: e.target.value })} />
              </div>
              <Field label="Deskripsi / quote" opt placeholder="Tiga gunung, satu cerita..." value={collection.deskripsi} onChange={(e) => patchC({ deskripsi: e.target.value })} />
              <Field label="Link QR code" opt placeholder="strava.com / linktr.ee / ..." value={collection.linkQr} onChange={(e) => patchC({ linkQr: e.target.value })} />

              {collection.hikes.map((h, i) => (
                <div key={i} className="clay-well p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">Gunung {i + 1}</span>
                    {collection.hikes.length > 2 && (
                      <button type="button" onClick={() => removeHike(i)} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-red-500">
                        <Trash2 size={12} /> Hapus
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Gunung" required placeholder="Gunung Sindoro" value={h.gunung} onChange={(e) => patchHike(i, { gunung: e.target.value })} />
                    <Field label="Via / jalur" required placeholder="Kledung" value={h.via} onChange={(e) => patchHike(i, { via: e.target.value })} />
                    <Field label="Tanggal" required placeholder="8 Sep 2025" value={h.tanggal} onChange={(e) => patchHike(i, { tanggal: e.target.value })} />
                    <Field label="Waktu tempuh" required placeholder="03:14:00" value={h.waktu} onChange={(e) => patchHike(i, { waktu: e.target.value })} />
                    <Field label="Ketinggian (mdpl)" required inputMode="numeric" placeholder="3153" value={h.ketinggian} onChange={(e) => patchHike(i, { ketinggian: e.target.value })} />
                    <Field label="Jarak (km)" required inputMode="decimal" placeholder="17.03" value={h.jarak} onChange={(e) => patchHike(i, { jarak: e.target.value })} />
                    <Field label="Elevation gain (m)" required inputMode="numeric" placeholder="1653" value={h.elevGain} onChange={(e) => patchHike(i, { elevGain: e.target.value })} />
                  </div>
                </div>
              ))}

              {collection.hikes.length < 3 && (
                <button type="button" onClick={addHike} className="clay-tile flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-zinc-500 transition-colors hover:text-[#9c4a2c] dark:text-zinc-400">
                  <Plus size={16} /> Tambah gunung ({collection.hikes.length}/3)
                </button>
              )}

              <label className={labelClass}>
                Catatan <span className="font-normal text-zinc-400">(opsional)</span>
                <textarea rows={2} className={inputClass} placeholder="Permintaan khusus..." value={collection.catatan} onChange={(e) => patchC({ catatan: e.target.value })} />
              </label>
            </>
          )}

          {/* alamat pengiriman — wajib, dipakai admin untuk kirim & print resi */}
          <div className="clay-well p-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Alamat pengiriman <span className="text-[#c05d3d]">*</span>
            </span>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Nama penerima" required placeholder="Nama sesuai alamat" value={shipping.penerima} onChange={(e) => patchShip({ penerima: e.target.value })} />
              <Field label="No HP / WA" required inputMode="tel" placeholder="08xxxxxxxxxx" value={shipping.hp} onChange={(e) => patchShip({ hp: e.target.value })} />
            </div>
            <label className={`${labelClass} mt-3`}>
              Alamat lengkap
              <textarea
                required
                rows={2}
                className={inputClass}
                placeholder="Jalan, RT/RW, kelurahan, kecamatan, kota, provinsi, kode pos"
                value={shipping.alamat}
                onChange={(e) => patchShip({ alamat: e.target.value })}
              />
            </label>
          </div>

          <div className="clay-well flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <span className="text-zinc-600 dark:text-zinc-300">
              {pkg ? pkg.name : "Belum pilih paket"} · {mode === "single" ? "1 pendakian" : `koleksi ${collection.hikes.length} gunung`} · <strong className="font-semibold">20x30 cm</strong>
            </span>
            <span className="flex items-baseline gap-2">
              {pkg?.strike && (
                <span className="text-xs font-semibold text-zinc-400 line-through decoration-[#c05d3d]/70 dark:text-zinc-500">
                  {pkg.strike}
                </span>
              )}
              <strong className="text-base font-bold text-[#b8532f] dark:text-[#e59a7c]">{pkg ? pkg.price : "—"}</strong>
              {mode === "collection" && <span className="text-xs text-zinc-400">total dikonfirmasi admin</span>}
            </span>
          </div>

          <button
            type="submit"
            className="t3d-btn mt-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-7 py-4 text-[15px] font-semibold text-white"
          >
            <MessageCircle size={17} /> Lanjut ke WhatsApp <ArrowUpRight size={15} />
          </button>
          <p className="text-center text-xs leading-relaxed text-zinc-400 dark:text-zinc-500">
            Data tidak disimpan di server mana pun — hanya dirangkai jadi pesan WhatsApp yang kamu kirim sendiri.
          </p>
        </form>
      </div>

      {/* ---- modal konfirmasi isi pesan (koreksi sebelum kirim) ---- */}
      {confirmMsg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmMsg(null)}
        >
          <div
            className="clay-card flex max-h-[85vh] w-full max-w-lg flex-col p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-md">
                <MessageCircle size={18} />
              </span>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Cek dulu datamu</h3>
                <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                  Ini pesan yang akan terkirim ke WhatsApp. Baca sekali lagi — kalau ada
                  yang keliru, tutup dan perbaiki di form.
                </p>
              </div>
            </div>

            <pre className="clay-well mt-4 flex-1 overflow-auto whitespace-pre-wrap break-words p-4 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-200">
              {confirmMsg}
            </pre>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmMsg(null)}
                className="clay-tile px-5 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                Kembali & perbaiki
              </button>
              <a
                href={waUrl(confirmMsg)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setConfirmMsg(null)}
                className="t3d-btn flex items-center justify-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-6 py-2.5 text-sm font-semibold text-white"
              >
                <MessageCircle size={15} /> Kirim ke WhatsApp <ArrowUpRight size={14} />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
