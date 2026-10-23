"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Zgjedhës minimal i restorantit aktiv. Shfaqet vetëm kur ka >1 anëtarësim.
export function RestaurantSwitcher({
  memberships,
  activeId,
}: {
  memberships: { restaurantId: string; name: string; role: string }[];
  activeId: string | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (memberships.length <= 1) return null;

  async function change(e: React.ChangeEvent<HTMLSelectElement>) {
    const restaurantId = e.target.value;
    setSaving(true);
    await fetch("/api/dashboard/active-restaurant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={activeId ?? ""}
      onChange={change}
      disabled={saving}
      aria-label="Restoranti aktiv"
      className="mt-3 w-full rounded-md border border-alpine-cream/15 bg-midnight px-2 py-1.5 text-sm text-alpine-cream outline-none focus:border-alpine-gold disabled:opacity-50 lg:mt-0 lg:mb-6"
    >
      {memberships.map((m) => (
        <option key={m.restaurantId} value={m.restaurantId}>
          {m.name} ({m.role})
        </option>
      ))}
    </select>
  );
}
