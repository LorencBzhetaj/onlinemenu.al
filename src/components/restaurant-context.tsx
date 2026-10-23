"use client";

import { createContext, useCallback, useContext } from "react";
import { useSearchParams } from "next/navigation";

// Restoranti i lidhur me faqen e hapur (i zgjidhur në SSR). Përcillet eksplicit te
// çdo thirrje private e API-t me header-in x-restaurant-id. Kjo e lidh kërkesën me
// faqen — ndryshimi i restorantit aktiv në një tab tjetër s'ndikon këtë faqe.
const RestaurantIdContext = createContext<string | null>(null);

export function RestaurantProvider({
  restaurantId,
  children,
}: {
  restaurantId: string | null;
  children: React.ReactNode;
}) {
  return <RestaurantIdContext.Provider value={restaurantId}>{children}</RestaurantIdContext.Provider>;
}

// Restoranti i faqes: ?r (per-tab, mbijeton refresh/back/forward) ose aktivi si fallback.
export function useRestaurantId(): string | null {
  const fallback = useContext(RestaurantIdContext);
  const fromUrl = useSearchParams().get("r");
  return fromUrl || fallback;
}

/** fetch që shton header-in x-restaurant-id te çdo thirrje private. */
export function useApiFetch() {
  const restaurantId = useRestaurantId();
  return useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (restaurantId) headers.set("x-restaurant-id", restaurantId);
      return fetch(input, { ...init, headers });
    },
    [restaurantId]
  );
}
