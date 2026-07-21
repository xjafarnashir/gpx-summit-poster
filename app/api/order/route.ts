import { NextResponse } from "next/server";
import { parseOrderPayload, saveOrder } from "@/lib/orderStore.server";

/**
 * POST /api/order — simpan pesanan masuk (PUBLIK, dipanggil landing saat
 * customer klik "Kirim ke WhatsApp"). Payload = OrderPayload yang sama dengan
 * blok kode di pesan WA; divalidasi lewat parser yang dipakai panel Impor.
 * Route ini publik di proxy — tidak butuh cookie.
 */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  let payload;
  try {
    payload = parseOrderPayload(raw);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Pesanan tidak valid." }, { status: 400 });
  }

  try {
    const record = await saveOrder(payload);
    return NextResponse.json({ ok: true, id: record.id });
  } catch {
    return NextResponse.json({ ok: false, error: "Gagal menyimpan pesanan." }, { status: 500 });
  }
}
