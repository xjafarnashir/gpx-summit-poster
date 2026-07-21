import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/apiAuth";
import { deleteOrder, listOrders } from "@/lib/orderStore.server";

/** GET /api/admin/orders — daftar pesanan masuk (admin). */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Hanya admin." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, orders: await listOrders() });
}

/** DELETE /api/admin/orders?id=... — hapus satu pesanan (admin). */
export async function DELETE(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ ok: false, error: "Hanya admin." }, { status: 401 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id wajib." }, { status: 400 });
  await deleteOrder(id);
  return NextResponse.json({ ok: true });
}
