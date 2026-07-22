"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogOut, Mountain } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

type Role = "admin" | "member" | null;

/**
 * Floating clay pill app bar shared by every page: brand on the left,
 * page-specific actions (if any) + the theme toggle on the right.
 *
 * Menu admin (Dashboard, Logout) hanya muncul bila /api/me memastikan cookie
 * admin valid — cookie httpOnly tak bisa dibaca JS, jadi perannya ditanyakan
 * ke server. Member/anon tidak melihat tombol yang akan menendang mereka.
 */
export default function AppHeader({ actions, wide }: { actions?: React.ReactNode; wide?: boolean }) {
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setRole((d?.role as Role) ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const logout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      window.location.href = "/admin";
    }
  };

  return (
    <header className="sticky top-0 z-40 px-4 pt-3 pb-1 xl:px-8">
      <div
        className={`clay-card mx-auto flex h-14 items-center gap-3 !rounded-full px-4 ${
          wide ? "max-w-none" : "max-w-6xl"
        }`}
      >
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-[0_6px_12px_-4px_var(--clay-drop),inset_0_2px_3px_rgba(255,255,255,0.5),inset_0_-3px_5px_rgba(0,0,0,0.25)]">
            <Mountain size={16} />
          </span>
          <span className="hidden truncate text-sm font-bold tracking-tight text-zinc-900 sm:inline dark:text-zinc-50">
            GPX Summit Poster
          </span>
        </Link>
        <div className="navbar-actions flex min-w-0 flex-1 items-center justify-end gap-2">
          {actions}
          {role === "admin" && (
            <>
              <Link
                href="/dashboard"
                title="Buka dashboard admin (pesanan, replay, member)"
                className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
              >
                <LayoutDashboard size={14} className="text-[#c05d3d] dark:text-[#e59a7c]" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <button
                type="button"
                onClick={logout}
                title="Keluar dari akun admin"
                className="clay-chip flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
