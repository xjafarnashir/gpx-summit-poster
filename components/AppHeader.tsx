"use client";

import Link from "next/link";
import { Mountain } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * Floating clay pill app bar shared by every page: brand on the left,
 * page-specific actions (if any) + the theme toggle on the right.
 */
export default function AppHeader({ actions }: { actions?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-40 px-4 pt-3 pb-1">
      <div className="clay-card mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 !rounded-full px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d97757] to-[#b8532f] text-white shadow-[0_6px_12px_-4px_var(--clay-drop),inset_0_2px_3px_rgba(255,255,255,0.5),inset_0_-3px_5px_rgba(0,0,0,0.25)]">
            <Mountain size={16} />
          </span>
          <span className="truncate text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            GPX Summit Poster
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
