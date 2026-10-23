"use client";

import { createContext, useCallback, useContext } from "react";

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

export function useRestaurantId(): string | null {
  return useContext(RestaurantIdContext);
}

/** fetch që shton header-in x-restaurant-id te çdo thirrje private. */
export function useApiFetch() {
  const restaurantId = useContext(RestaurantIdContext);
  return useCallback(
    (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (restaurantId) headers.set("x-restaurant-id", restaurantId);
      return fetch(input, { ...init, headers });
    },
    [restaurantId]
  );
}
