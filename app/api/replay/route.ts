import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, adminToken } from "@/lib/adminAuth";
import { generateReplayId, parseReplayData, replayPath } from "@/lib/replay";
import { writeReplay } from "@/lib/replayStore.server";

/**
 * POST /api/replay — buat Summit Replay baru (khusus admin, dipanggil dari
 * /editor). Halaman publiknya TIDAK lewat API: server component
 * app/landingpage/replay/[id] membaca store langsung, jadi route ini tidak
 * perlu masuk allowlist proxy (admin ber-cookie sudah lolos proxy).
 */
export async function POST(request: NextRequest) {
  // Saat `next dev` gerbang admin nonaktif (sama seperti proxy.ts).
  const isDev = process.env.NODE_ENV === "development";
  if (!isDev && request.cookies.get(ADMIN_COOKIE)?.value !== (await adminToken())) {
    return NextResponse.json({ ok: false, error: "Hanya admin yang bisa membuat replay." }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }

  const data = parseReplayData(raw);
  if (!data) {
    return NextResponse.json({ ok: false, error: "Data replay tidak valid." }, { status: 400 });
  }

  const id = generateReplayId();
  try {
    await writeReplay(id, data);
  } catch {
    return NextResponse.json({ ok: false, error: "Gagal menyimpan replay." }, { status: 500 });
  }

  // `url` hanya kenyamanan dev; editor merakit URL final dari
  // window.location.origin supaya origin internal hosting tak bocor ke poster.
  return NextResponse.json({ ok: true, id, url: new URL(replayPath(id), request.nextUrl.origin).toString() });
}
