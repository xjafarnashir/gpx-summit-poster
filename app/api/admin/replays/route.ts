import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/apiAuth";
import { deleteReplay, listReplays } from "@/lib/replayStore.server";

/** GET /api/admin/replays — daftar Summit Replay yang sudah dibuat (admin). */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Hanya admin." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, replays: await listReplays() });
}

/** DELETE /api/admin/replays?id=... — hapus satu replay (admin). */
export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Hanya admin." }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id wajib." }, { status: 400 });
  await deleteReplay(id);
  return NextResponse.json({ ok: true });
}
