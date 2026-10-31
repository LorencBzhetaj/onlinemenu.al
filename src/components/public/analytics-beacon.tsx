"use client";

import { useEffect, useRef } from "react";

export type PublicEventType = "profile_view" | "menu_view" | "item_view" | "wolt_click";

/** Dërgon një event publik analitike pa bllokuar navigimin (sendBeacon → fallback fetch). */
export function sendEvent(slug: string, type: PublicEventType, itemId?: string): void {
  if (!slug) return;
  try {
    const body = JSON.stringify({ slug, type, itemId });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/public/events", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/public/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch {
    // Analitika s'duhet të prekë përvojën e përdoruesit.
  }
}

/** Fire-and-forget një event page-view një herë në mount. Nuk renderon asgjë. */
export function AnalyticsBeacon({ slug, type }: { slug: string; type: "profile_view" | "menu_view" }) {
  const fired = useRef(false);
  useEffect(() => {
    if (!fired.current) {
      fired.current = true;
      sendEvent(slug, type);
    }
  }, [slug, type]);
  return null;
}
