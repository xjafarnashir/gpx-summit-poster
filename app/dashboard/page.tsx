"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  Copy,
  Loader2,
  LogOut,
  Mountain,
  Package,
  PlayCircle,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { packageById, type PackageId } from "@/lib/landing";
import { replayPath, type ReplayListItem } from "@/lib/replay";
import type { OrderPayload } from "@/lib/orderPayload";

/* ============================================================================
 * Dashboard admin (khusus admin utama). Tiga bagian: Pesanan masuk, Summit
 * Replay, dan Member. Member yang login diarahkan ke /editor, bukan ke sini.
 * ========================================================================== */

interface OrderRecord {
  id: string;
  createdAt: number;
  payload: OrderPayload;
}
interface MemberPublic {
  id: string;
  username: string;
  exportCount: number;
  createdAt: number;
  lastExportAt: number | null;
}

type Tab = "orders" | "replays" | "members";

const fmtDate = (ms: number | null): string =>
  ms == null ? "—" : new Date(ms).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
const fmtDateTime = (ms: number | null): string =>
  ms == null
    ? "—"
    : new Date(ms).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const pkgName = (id: string): string => packageById(id as PackageId)?.name ?? id ?? "—";

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<OrderRecord[] | null>(null);
  const [replays, setReplays] = useState<ReplayListItem[] | null>(null);
  const [members, setMembers] = useState<MemberPublic[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [o, r, m] = await Promise.all([
        fetch("/api/admin/orders").then((res) => res.json()),
        fetch("/api/admin/replays").then((res) => res.json()),
        fetch("/api/admin/members").then((res) => res.json()),
      ]);
      if (o.ok) setOrders(o.orders);
      if (r.ok) setReplays(r.replays);
      if (m.ok) setMembers(m.members);
      setError(o.ok && r.ok && m.ok ? null : "Sebagian data gagal dimuat. Coba muat ulang.");
    } catch {
      setError("Gagal terhubung ke server.");
    }
  }, []);

  useEffect(() => {
    // loadAll hanya setState setelah await fetch (bukan sinkron), jadi tidak
    // memicu cascading render — aturan ini false-positive di sini.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  const logout = async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/admin";
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 px-4 pt-3 pb-1">
        <div className="clay-card mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 !rounded-full px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white">
              <Mountain size={16} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">myKoordinat</div>
              <div className="text-xs text-zinc-400 dark:text-zinc-500">Dashboard admin</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              href="/"
              className="clay-chip flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100 sm:text-sm"
            >
              Buka Editor
            </Link>
            <button
              type="button"
              onClick={logout}
              className="clay-chip flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-600 transition-colors hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 sm:text-sm"
            >
              <LogOut size={14} /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-8">
        {/* tab bar */}
        <div className="clay-well inline-flex flex-wrap gap-1 p-1">
          {(
            [
              { id: "orders", label: "Pesanan", icon: Package, count: orders?.length },
              { id: "replays", label: "Summit Replay", icon: PlayCircle, count: replays?.length },
              { id: "members", label: "Member", icon: Users, count: members?.length },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-gradient-to-r from-[#d97757] to-[#b8532f] text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              }`}
            >
              <t.icon size={15} />
              {t.label}
              {typeof t.count === "number" && (
                <span className={`rounded-full px-1.5 text-xs ${tab === t.id ? "bg-white/25" : "bg-zinc-200 dark:bg-zinc-700"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
        )}

        <div className="mt-6">
          {tab === "orders" && <OrdersSection orders={orders} onChanged={loadAll} />}
          {tab === "replays" && <ReplaysSection replays={replays} onChanged={loadAll} />}
          {tab === "members" && <MembersSection members={members} onChanged={loadAll} />}
        </div>
      </main>
    </div>
  );
}

/* --------------------------------- Pesanan -------------------------------- */

function OrdersSection({ orders, onChanged }: { orders: OrderRecord[] | null; onChanged: () => void }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (orders === null) return <Loading />;
  if (orders.length === 0) return <Empty icon={Package} text="Belum ada pesanan masuk." />;

  const copyCode = async (o: OrderRecord) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(o.payload));
      setCopiedId(o.id);
      setTimeout(() => setCopiedId((c) => (c === o.id ? null : c)), 1800);
    } catch {
      /* clipboard diblokir */
    }
  };

  const remove = async (o: OrderRecord) => {
    if (!confirm("Hapus pesanan ini? Tidak bisa dibatalkan.")) return;
    setBusyId(o.id);
    await fetch(`/api/admin/orders?id=${o.id}`, { method: "DELETE" });
    setBusyId(null);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-3">
      {orders.map((o) => {
        const p = o.payload;
        const title = p.jenis === "single" ? p.gunung || "(tanpa gunung)" : p.judul || "(tanpa judul)";
        const who = p.jenis === "single" ? p.nama : p.pendaki;
        return (
          <div key={o.id} className="clay-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#f7e9e1] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#9c4a2c] dark:bg-[#3a2a22] dark:text-[#e59a7c]">
                    {p.jenis === "single" ? "1 Pendakian" : `Koleksi ${p.gunung.length} gunung`}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">{fmtDateTime(o.createdAt)}</span>
                </div>
                <h3 className="mt-1.5 truncate text-base font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {who || "—"} · Paket {pkgName(p.paket)}
                  {p.qrReplay && <span className="ml-1 text-[#9c4a2c] dark:text-[#e59a7c]">· minta Summit Replay</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyCode(o)}
                  title="Salin kode pesanan untuk di-paste ke panel Impor di editor"
                  className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:text-[#9c4a2c] dark:text-zinc-300 dark:hover:text-[#e59a7c]"
                >
                  {copiedId === o.id ? <ClipboardCheck size={13} /> : <Copy size={13} />}
                  {copiedId === o.id ? "Tersalin" : "Salin kode"}
                </button>
                <button
                  type="button"
                  onClick={() => remove(o)}
                  disabled={busyId === o.id}
                  className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:text-red-600 disabled:opacity-60 dark:text-zinc-300 dark:hover:text-red-400"
                >
                  {busyId === o.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Hapus
                </button>
              </div>
            </div>

            <div className="clay-well mt-3 p-3 text-sm text-zinc-600 dark:text-zinc-300">
              <span className="font-semibold">Kirim ke:</span> {p.kirim.penerima || "—"} · {p.kirim.hp || "—"}
              <div className="mt-0.5 whitespace-pre-wrap text-zinc-500 dark:text-zinc-400">{p.kirim.alamat || "—"}</div>
              {p.catatan && <div className="mt-1.5 italic text-zinc-500 dark:text-zinc-400">Catatan: “{p.catatan}”</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------ Summit Replay ----------------------------- */

function ReplaysSection({ replays, onChanged }: { replays: ReplayListItem[] | null; onChanged: () => void }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (replays === null) return <Loading />;
  if (replays.length === 0) return <Empty icon={PlayCircle} text="Belum ada Summit Replay yang dibuat." />;

  const remove = async (r: ReplayListItem) => {
    if (!confirm("Hapus Summit Replay ini? QR yang sudah dicetak akan mati (404).")) return;
    setBusyId(r.id);
    await fetch(`/api/admin/replays?id=${r.id}`, { method: "DELETE" });
    setBusyId(null);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-3">
      {replays.map((r) => (
        <div key={r.id} className="clay-card flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#f7e9e1] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[#9c4a2c] dark:bg-[#3a2a22] dark:text-[#e59a7c]">
                {r.kind === "single" ? "Single" : "Koleksi"}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">{fmtDate(r.createdAt)}</span>
            </div>
            <h3 className="mt-1.5 truncate text-base font-bold text-zinc-900 dark:text-zinc-50">{r.title}</h3>
            <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500">{r.id}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={replayPath(r.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:text-[#9c4a2c] dark:text-zinc-300 dark:hover:text-[#e59a7c]"
            >
              <PlayCircle size={13} /> Buka
            </a>
            <button
              type="button"
              onClick={() => remove(r)}
              disabled={busyId === r.id}
              className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:text-red-600 disabled:opacity-60 dark:text-zinc-300 dark:hover:text-red-400"
            >
              {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Hapus
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Member --------------------------------- */

function MembersSection({ members, onChanged }: { members: MemberPublic[] | null; onChanged: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAddError(data.error ?? "Gagal menambah member.");
        return;
      }
      setUsername("");
      setPassword("");
      onChanged();
    } catch {
      setAddError("Gagal terhubung ke server.");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (m: MemberPublic) => {
    if (!confirm(`Hapus member "${m.username}"? Ia tidak bisa login lagi.`)) return;
    setBusyId(m.id);
    await fetch(`/api/admin/members?id=${m.id}`, { method: "DELETE" });
    setBusyId(null);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* form tambah member */}
      <form onSubmit={add} className="clay-card p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">
          <UserPlus size={16} className="text-[#c05d3d] dark:text-[#e59a7c]" /> Tambah member
        </div>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Member bisa login di <span className="font-mono">/admin</span> dan langsung masuk ke editor. Tiap Export Full tercatat di sini.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            required
            autoComplete="off"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <input
            type="text"
            required
            autoComplete="off"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-zinc-300 px-3.5 py-2.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={adding}
            className="clay-btn flex items-center justify-center gap-2 bg-gradient-to-r from-[#d97757] to-[#b8532f] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
          >
            {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Tambah
          </button>
        </div>
        {addError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{addError}</p>}
      </form>

      {/* daftar member */}
      {members === null ? (
        <Loading />
      ) : members.length === 0 ? (
        <Empty icon={Users} text="Belum ada member. Tambahkan di atas." />
      ) : (
        <div className="flex flex-col gap-3">
          {members.map((m) => (
            <div key={m.id} className="clay-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-bold text-zinc-900 dark:text-zinc-50">{m.username}</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Dibuat {fmtDate(m.createdAt)} · ekspor terakhir {fmtDateTime(m.lastExportAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-[#b8532f] dark:text-[#e59a7c]">{m.exportCount}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Export Full</div>
                </div>
                <button
                  type="button"
                  onClick={() => remove(m)}
                  disabled={busyId === m.id}
                  className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 transition-colors hover:text-red-600 disabled:opacity-60 dark:text-zinc-300 dark:hover:text-red-400"
                >
                  {busyId === m.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------- shared ---------------------------------- */

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-400">
      <Loader2 size={16} className="animate-spin" /> Memuat…
    </div>
  );
}

function Empty({ icon: Icon, text }: { icon: typeof Package; text: string }) {
  return (
    <div className="clay-well flex flex-col items-center gap-2 py-16 text-center text-sm text-zinc-400 dark:text-zinc-500">
      <Icon size={28} className="opacity-50" />
      {text}
    </div>
  );
}
