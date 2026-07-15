"use client";

import { useState } from "react";
import { ClipboardPaste, Printer, X } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { makeEmptyHike } from "@/lib/store";
import { extractOrderPayload, orderSummary, parseNum } from "@/lib/orderPayload";
import { WA_NUMBER, packageById, type PackageId } from "@/lib/landing";
import { bgThemeById } from "@/lib/backgroundThemes";

/* ============================================================================
 * Fitur admin di NAVBAR /editor: tombol "Impor" membuka modal untuk paste
 * pesan WhatsApp customer (berisi kode pesanan JSON dari /landingpage/pesan)
 * → semua data poster terisi otomatis (single ATAU koleksi) + alamat
 * pengiriman tersimpan → tombol "Resi" mencetak resi pengiriman.
 * ========================================================================== */

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export default function ImportOrderPanel() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const shipping = useAppStore((s) => s.shipping);
  const setShipping = useAppStore((s) => s.setShipping);
  const setPosterMode = useAppStore((s) => s.setPosterMode);
  const setStats = useAppStore((s) => s.setStats);
  const setTheme = useAppStore((s) => s.setTheme);
  const setCollectionMeta = useAppStore((s) => s.setCollectionMeta);
  const setCollectionHikes = useAppStore((s) => s.setCollectionHikes);

  const closeModal = () => {
    setOpen(false);
    setError(null);
    setOkMsg(null);
    setText("");
  };

  const handleImport = () => {
    setError(null);
    setOkMsg(null);
    try {
      const p = extractOrderPayload(text);
      const bg = bgThemeById(p.tema).id; // fallback ke sunset bila id tak dikenal

      if (p.jenis === "single") {
        setPosterMode("single");
        setStats({
          climberName: p.nama,
          mountainName: p.gunung,
          viaRoute: p.via,
          date: p.tanggal,
          summitElevationM: Math.round(parseNum(p.mdpl)),
          distanceKm: parseNum(p.km),
          elevationGainM: Math.round(parseNum(p.gain)),
          movingTime: p.waktu || "00:00:00",
          instagram: p.ig,
          tiktok: p.tt,
          qrCodeUrl: p.qr,
        });
        setTheme({ backgroundTheme: bg });
      } else {
        setPosterMode("collection");
        setCollectionMeta({
          expeditionTitle: p.judul,
          expeditionDesc: p.deskripsi,
          climberName: p.pendaki,
          instagram: p.ig,
          tiktok: p.tt,
          qrCodeUrl: p.qr,
          backgroundTheme: bg,
        });
        setCollectionHikes(
          p.gunung.map((g) => ({
            ...makeEmptyHike(),
            mountainName: g.nama,
            viaRoute: g.via,
            date: g.tanggal,
            summitElevationM: Math.round(parseNum(g.mdpl)),
            distanceKm: parseNum(g.km),
            elevationGainM: Math.round(parseNum(g.gain)),
            movingTime: g.waktu || "00:00:00",
          }))
        );
      }

      setShipping({ ...p.kirim, paket: p.paket, ringkasan: orderSummary(p) });

      const parts = [
        p.jenis === "single" ? `Pesanan 1 pendakian (${p.gunung || "-"}) terisi.` : `Pesanan koleksi ${p.gunung.length} gunung terisi.`,
        "Tinggal upload GPX + foto.",
      ];
      if (p.catatan) parts.push(`Catatan customer: "${p.catatan}"`);
      setOkMsg(parts.join(" "));
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membaca kode pesanan.");
    }
  };

  const handlePrintResi = () => {
    if (!shipping) return;
    const pkg = packageById(shipping.paket as PackageId);
    const now = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Resi — ${esc(shipping.penerima)}</title>
<style>
  @page { size: A6; margin: 7mm; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #1a1a1a; font-size: 11px; line-height: 1.45; }
  .frame { border: 1.6px solid #1a1a1a; border-radius: 6px; padding: 10px 12px; }
  .brand { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.6px solid #1a1a1a; padding-bottom: 6px; }
  .brand b { font-size: 15px; letter-spacing: 0.2px; }
  .brand span { font-size: 9px; color: #555; }
  .sec { margin-top: 9px; }
  .lbl { font-size: 8px; font-weight: 700; letter-spacing: 1.4px; color: #777; text-transform: uppercase; }
  .penerima { font-size: 16px; font-weight: 800; margin-top: 1px; }
  .hp { font-size: 12px; font-weight: 600; }
  .alamat { margin-top: 2px; font-size: 11.5px; white-space: pre-wrap; }
  .isi { margin-top: 2px; }
  .foot { margin-top: 10px; display: flex; justify-content: space-between; border-top: 1px dashed #999; padding-top: 6px; font-size: 9px; color: #666; }
</style></head><body>
<div class="frame">
  <div class="brand"><b>myKoordinat</b><span>RESI PENGIRIMAN</span></div>
  <div class="sec">
    <div class="lbl">Penerima</div>
    <div class="penerima">${esc(shipping.penerima)}</div>
    <div class="hp">${esc(shipping.hp)}</div>
    <div class="alamat">${esc(shipping.alamat)}</div>
  </div>
  <div class="sec">
    <div class="lbl">Isi paket</div>
    <div class="isi">${esc(shipping.ringkasan)}${pkg ? ` — ${esc(pkg.name)} (${esc(pkg.mount)})` : ""}</div>
  </div>
  <div class="sec">
    <div class="lbl">Pengirim</div>
    <div>myKoordinat · WA +${esc(WA_NUMBER)}</div>
  </div>
  <div class="foot"><span>Fragile: jangan ditekuk / ditindih</span><span>Dicetak ${esc(now)}</span></div>
</div>
<script>window.onload = function(){ window.print(); };</script>
</body></html>`;
    const w = window.open("", "_blank", "width=460,height=640");
    if (!w) {
      alert("Popup diblokir browser — izinkan popup untuk print resi.");
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  return (
    <>
      {/* Tombol navbar */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-600 transition-colors hover:text-[#9c4a2c] dark:text-zinc-300 dark:hover:text-[#e59a7c] sm:px-3.5 sm:text-sm"
        title="Impor pesanan (JSON dari WhatsApp)"
      >
        <ClipboardPaste size={13} />
        <span className="hidden sm:inline">Impor</span>
      </button>
      {shipping && (
        <button
          type="button"
          onClick={handlePrintResi}
          className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs text-zinc-600 transition-colors hover:text-[#9c4a2c] dark:text-zinc-300 dark:hover:text-[#e59a7c] sm:px-3.5 sm:text-sm"
          title={`Print resi — ${shipping.penerima} · ${shipping.hp} · ${shipping.alamat}`}
        >
          <Printer size={13} />
          <span className="hidden sm:inline">Resi</span>
        </button>
      )}

      {/* Modal impor */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeModal}
        >
          <div className="clay-card flex max-h-[85vh] w-full max-w-lg flex-col p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-md">
                  <ClipboardPaste size={18} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Impor Pesanan</h3>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    Paste seluruh pesan WhatsApp customer — data poster & alamat kirim terisi otomatis.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="shrink-0 rounded-md p-1.5 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                aria-label="Tutup"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Paste pesan WhatsApp di sini (yang ada blok {"v":1,...} di bagian bawah).'
              className="mt-4 w-full flex-1 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs text-zinc-800 placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-600"
            />

            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            {okMsg && (
              <p className="mt-2 rounded-md bg-emerald-50 p-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                {okMsg}
              </p>
            )}
            {shipping && (
              <p className="mt-2 font-mono text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Kirim ke: {shipping.penerima} · {shipping.hp} · {shipping.alamat}
              </p>
            )}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="clay-tile px-5 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                {okMsg ? "Tutup" : "Batal"}
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!text.trim()}
                className="clay-btn bg-gradient-to-r from-[#d97757] to-[#b8532f] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
              >
                Impor & isi otomatis
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
