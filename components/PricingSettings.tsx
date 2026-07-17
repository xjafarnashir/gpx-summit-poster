"use client";

import { useEffect, useState } from "react";
import { Loader2, Tag, X } from "lucide-react";
import { PACKAGES } from "@/lib/landing";
import { DEFAULT_PRICING, formatRupiah, parsePricing, type Pricing } from "@/lib/pricing";

/**
 * Setelan harga paket di NAVBAR /editor. Nilai tersimpan di server
 * (Netlify Blobs / file lokal saat dev) dan langsung dipakai landing page +
 * form pesan customer — tanpa deploy ulang.
 */
export default function PricingSettings() {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<keyof Pricing, string>>({
    hemat: String(DEFAULT_PRICING.hemat),
    premium: String(DEFAULT_PRICING.premium),
    hematStrike: String(DEFAULT_PRICING.hematStrike),
    premiumStrike: String(DEFAULT_PRICING.premiumStrike),
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const openModal = () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setOkMsg(null);
  };

  // Muat harga tersimpan tiap modal dibuka (state transien direset di openModal).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/pricing")
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const parsed = parsePricing(raw);
        if (parsed && !cancelled)
          setValues({
            hemat: String(parsed.hemat),
            premium: String(parsed.premium),
            hematStrike: String(parsed.hematStrike),
            premiumStrike: String(parsed.premiumStrike),
          });
      })
      .catch(() => {
        if (!cancelled) setError("Gagal memuat harga tersimpan — menampilkan default.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const parsed = parsePricing(values);

  const handleSave = async () => {
    if (!parsed) return;
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? "Gagal menyimpan harga.");
        return;
      }
      setOkMsg(`Tersimpan — landing page kini menampilkan ${formatRupiah(parsed.hemat)} / ${formatRupiah(parsed.premium)}.`);
    } catch {
      setError("Gagal terhubung ke server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        title="Setel harga paket di landing page"
        className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-600 transition-colors hover:text-[#9c4a2c] dark:text-zinc-300 dark:hover:text-[#e59a7c] sm:px-3.5 sm:text-sm"
      >
        <Tag size={13} />
        <span className="hidden sm:inline">Harga</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div className="clay-card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-md">
                  <Tag size={18} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Harga Paket</h3>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    Langsung tampil di landing page & form pesan — tanpa deploy ulang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {PACKAGES.map((p) => {
                const strikeKey = (p.id === "hemat" ? "hematStrike" : "premiumStrike") as keyof Pricing;
                const strikeVal = parsed ? parsed[strikeKey] : 0;
                return (
                  <div key={p.id} className="clay-well p-3.5">
                    <div className="flex items-baseline justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      <span>
                        {p.name} <span className="font-normal text-zinc-400">({p.mount})</span>
                      </span>
                      <span className="font-mono text-xs text-[#9c4a2c] dark:text-[#e59a7c]">
                        {parsed ? (
                          <>
                            {strikeVal > 0 && <s className="mr-1.5 text-zinc-400">{formatRupiah(strikeVal)}</s>}
                            {formatRupiah(parsed[p.id])}
                          </>
                        ) : (
                          "cek angka…"
                        )}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Harga coret (awal)
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          inputMode="numeric"
                          disabled={loading}
                          value={values[strikeKey]}
                          onChange={(e) => setValues((v) => ({ ...v, [strikeKey]: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </label>
                      <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Harga promo
                        <input
                          type="number"
                          min={1000}
                          step={1000}
                          inputMode="numeric"
                          disabled={loading}
                          value={values[p.id]}
                          onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-zinc-400">
                Harga coret harus lebih besar dari harga promo. Isi <strong>0</strong> untuk tampil tanpa coret.
              </p>
            </div>

            {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {okMsg && (
              <p className="mt-3 rounded-md bg-emerald-50 p-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                {okMsg}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="clay-tile px-5 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!parsed || saving || loading}
                className="clay-btn flex items-center justify-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Tag size={15} />}
                Simpan Harga
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
