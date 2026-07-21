/* ============================================================================
 * Kode pesanan (JSON) yang ikut terkirim di pesan WhatsApp dari
 * /landingpage/pesan, lalu di-PASTE admin ke panel "Impor Pesanan" di /editor
 * untuk mengisi semua data otomatis (tanpa input satu-satu) + print resi.
 *
 * Format sengaja memakai key pendek berbahasa Indonesia supaya pesan WA tetap
 * ringkas dan gampang dicek mata. Versi (`v`) dinaikkan bila strukturnya
 * berubah, agar importer bisa menolak/menyesuaikan payload lama.
 * ========================================================================== */

export interface OrderShipping {
  penerima: string;
  hp: string;
  alamat: string;
}

export interface OrderHikePayload {
  nama: string;
  via: string;
  tanggal: string;
  mdpl: string;
  km: string;
  gain: string;
  waktu: string;
}

interface OrderPayloadBase {
  v: 1;
  /** Id paket dari lib/landing (hemat | premium). */
  paket: string;
  /** Id tema latar dari lib/backgroundThemes. */
  tema: string;
  ig: string;
  tt: string;
  /** Link QR bebas (Strava/Linktree/dll). Kosong bila customer pilih replay. */
  qr: string;
  /** true = customer minta QR berupa Summit Replay (animasi), bukan link biasa. */
  qrReplay: boolean;
  catatan: string;
  kirim: OrderShipping;
}

export interface OrderPayloadSingle extends OrderPayloadBase {
  jenis: "single";
  nama: string;
  gunung: string;
  via: string;
  tanggal: string;
  mdpl: string;
  km: string;
  gain: string;
  waktu: string;
}

export interface OrderPayloadCollection extends OrderPayloadBase {
  jenis: "koleksi";
  judul: string;
  pendaki: string;
  deskripsi: string;
  gunung: OrderHikePayload[];
}

export type OrderPayload = OrderPayloadSingle | OrderPayloadCollection;

/** Penanda blok kode di pesan WA — importer mencari JSON setelahnya. */
export const ORDER_JSON_LABEL = "Kode pesanan (jangan diedit, untuk proses otomatis admin):";

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

/** "2.565" / "8,5 km" → angka. 0 bila tidak bisa diparse. */
export function parseNum(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Ambil + validasi payload dari teks tempelan bebas (boleh seluruh pesan WA,
 * boleh JSON-nya saja). Melempar Error berpesan Indonesia bila tidak valid.
 */
export function extractOrderPayload(text: string): OrderPayload {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new Error("Tidak menemukan kode JSON di teks yang ditempel. Salin seluruh pesan WhatsApp dari customer.");
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Kode JSON tidak utuh / berubah. Pastikan menyalin pesan WhatsApp apa adanya.");
  }
  if (typeof raw !== "object" || raw === null) throw new Error("Kode pesanan tidak valid.");
  const o = raw as Record<string, unknown>;

  if (o.v !== 1) throw new Error(`Versi kode pesanan tidak dikenal (v=${str(o.v) || "?"}).`);
  if (o.jenis !== "single" && o.jenis !== "koleksi") {
    throw new Error("Jenis pesanan tidak dikenal — harus single atau koleksi.");
  }

  const k = (o.kirim ?? {}) as Record<string, unknown>;
  const kirim: OrderShipping = { penerima: str(k.penerima), hp: str(k.hp), alamat: str(k.alamat) };

  const base = {
    v: 1 as const,
    paket: str(o.paket),
    tema: str(o.tema) || "sunset",
    ig: str(o.ig),
    tt: str(o.tt),
    qr: str(o.qr),
    qrReplay: o.qrReplay === true,
    catatan: str(o.catatan),
    kirim,
  };

  if (o.jenis === "single") {
    return {
      ...base,
      jenis: "single",
      nama: str(o.nama),
      gunung: str(o.gunung),
      via: str(o.via),
      tanggal: str(o.tanggal),
      mdpl: str(o.mdpl),
      km: str(o.km),
      gain: str(o.gain),
      waktu: str(o.waktu),
    };
  }

  const gunung = (Array.isArray(o.gunung) ? o.gunung : []).map((g) => {
    const h = (g ?? {}) as Record<string, unknown>;
    return {
      nama: str(h.nama),
      via: str(h.via),
      tanggal: str(h.tanggal),
      mdpl: str(h.mdpl),
      km: str(h.km),
      gain: str(h.gain),
      waktu: str(h.waktu),
    };
  });
  if (gunung.length < 2) throw new Error("Pesanan koleksi butuh minimal 2 gunung di kode JSON.");

  return {
    ...base,
    jenis: "koleksi",
    judul: str(o.judul),
    pendaki: str(o.pendaki),
    deskripsi: str(o.deskripsi),
    gunung: gunung.slice(0, 3),
  };
}

/** Ringkasan isi paket untuk resi pengiriman. */
export function orderSummary(p: OrderPayload): string {
  return p.jenis === "single"
    ? `Poster pendakian ${p.gunung || "-"} 20x30 cm (jalur 3D timbul)`
    : `Poster koleksi ${p.gunung.length} gunung 20x30 cm (jalur 3D timbul)`;
}
