"use client";

import { useEffect, useState } from "react";
import { DEFAULT_PRICING, parsePricing, type Pricing } from "@/lib/pricing";

/** Harga paket terkini dari server; sebelum termuat memakai default. */
export function usePricing(): Pricing {
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pricing")
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const parsed = parsePricing(raw);
        if (parsed && !cancelled) setPricing(parsed);
      })
      .catch(() => {
        /* offline / gagal: pakai default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return pricing;
}
