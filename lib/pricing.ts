import { PACKAGES, type PosterPackage } from "@/lib/landing";

/* ============================================================================
 * Harga paket yang bisa DISETEL ADMIN dari /editor (tanpa deploy ulang).
 *
 * Kenapa tidak di localStorage: landing page dilihat CUSTOMER di browser
 * mereka — setelan di browser admin tidak akan sampai ke sana. Maka harga
 * disimpan sisi server (Netlify Blobs saat production, file lokal saat dev)
 * dan dibaca lewat GET /api/pricing. Nilai di lib/landing.ts menjadi DEFAULT
 * bila belum pernah disetel.
 * ========================================================================== */

export interface Pricing {
  /** Harga PROMO per paket dalam rupiah utuh (mis. 50000). */
  hemat: number;
  premium: number;
  /** Harga CORET (awal, sebelum promo). 0 = tanpa coret. */
  hematStrike: number;
  premiumStrike: number;
}

export const DEFAULT_PRICING: Pricing = {
  hemat: 50000,
  premium: 80000,
  hematStrike: 70000,
  premiumStrike: 100000,
};

export function formatRupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

/**
 * Validasi payload harga dari API/form. Harga coret opsional (0 = tanpa
 * coret); bila diisi harus LEBIH BESAR dari harga promonya supaya masuk akal.
 * Data lama tanpa field coret tetap valid (coret dianggap 0).
 */
export function parsePricing(raw: unknown): Pricing | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const price = (v: unknown): number | null => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 1000 || n > 100_000_000) return null;
    return Math.round(n);
  };
  const strike = (v: unknown, promo: number): number | null => {
    if (v === undefined || v === null || v === "" || Number(v) === 0) return 0;
    const n = price(v);
    if (n === null || n <= promo) return null;
    return n;
  };

  const hemat = price(o.hemat);
  const premium = price(o.premium);
  if (hemat === null || premium === null) return null;
  const hematStrike = strike(o.hematStrike, hemat);
  const premiumStrike = strike(o.premiumStrike, premium);
  if (hematStrike === null || premiumStrike === null) return null;

  return { hemat, premium, hematStrike, premiumStrike };
}

/** PACKAGES dengan harga promo + coret sesuai setelan admin. */
export function applyPricing(pricing: Pricing): PosterPackage[] {
  return PACKAGES.map((p) => {
    const strikeValue = p.id === "hemat" ? pricing.hematStrike : pricing.premiumStrike;
    return {
      ...p,
      price: formatRupiah(pricing[p.id]),
      strike: strikeValue > 0 ? formatRupiah(strikeValue) : undefined,
    };
  });
}
