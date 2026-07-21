import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/apiAuth";
import { addMember, deleteMember, listMembers } from "@/lib/memberStore.server";

/** GET /api/admin/members — daftar member + jumlah ekspor (admin). */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Hanya admin." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, members: await listMembers() });
}

/** POST /api/admin/members — buat member baru { username, password } (admin). */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Hanya admin." }, { status: 401 });
  }
  let body: { username?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body tidak valid." }, { status: 400 });
  }
  const result = await addMember(body.username ?? "", body.password ?? "");
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

/** DELETE /api/admin/members?id=... — hapus member (admin). */
export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Hanya admin." }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id wajib." }, { status: 400 });
  await deleteMember(id);
  return NextResponse.json({ ok: true });
}
