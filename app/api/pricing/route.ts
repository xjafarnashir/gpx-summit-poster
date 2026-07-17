import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken } from "@/lib/adminAuth";
import { parsePricing } from "@/lib/pricing";
import { readPricing, writePricing } from "@/lib/pricingStore.server";

/**
 * GET  /api/pricing — publik (dipakai landing page & form pesan customer).
 * POST /api/pricing — khusus admin (cookie login yang sama dengan /editor);
 *                     proxy melepas route ini ke publik, jadi POST dijaga di sini.
 */
export async function GET() {
  return NextResponse.json(await readPricing());
}

export async function POST(request: NextRequest) {
  // Saat `next dev` gerbang admin nonaktif (sama seperti proxy.ts).
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && request.cookies.get(ADMIN_COOKIE)?.value !== (await adminToken())) {
    return NextResponse.json({ ok: false, error: "Hanya admin yang bisa mengubah harga." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  const pricing = parsePricing(raw);
  if (!pricing) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Harga tidak valid — harga promo min Rp1.000, dan harga coret harus lebih besar dari promonya (atau 0 untuk tanpa coret).",
      },
      { status: 400 }
    );
  }

  try {
    await writePricing(pricing);
  } catch {
    return NextResponse.json({ ok: false, error: "Gagal menyimpan harga." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, pricing });
}
