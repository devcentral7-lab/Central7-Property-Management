"use client";

import { createContext, useContext, type ReactNode } from "react";
import { LEGACY_CITIES } from "@/lib/cities";

const CitiesContext = createContext<readonly string[]>(LEGACY_CITIES);

export function CitiesProvider({ cities, children }: { cities: readonly string[]; children: ReactNode }) {
  return <CitiesContext.Provider value={cities}>{children}</CitiesContext.Provider>;
}

export function useCities(): readonly string[] {
  return useContext(CitiesContext);
}
