"use client";

import { useEffect, useMemo, useState } from "react";
import { citySpellingKey } from "@/lib/cities";
import type { PlaceSuggestion } from "@/lib/places/sri-lanka-cities";

export type CitySuggestion = {
  value: string;
  label: string;
  source: "known" | "google";
};

function merge(known: readonly string[], remote: readonly PlaceSuggestion[], query: string): CitySuggestion[] {
  const term = query.trim().toLowerCase();
  const local = (term ? known.filter((c) => c.toLowerCase().includes(term)) : [...known]).map(
    (value) => ({ value, label: value, source: "known" as const }),
  );
  const seen = new Set(local.map((c) => citySpellingKey(c.value)));
  const extra: CitySuggestion[] = [];
  for (const r of remote) {
    const k = citySpellingKey(r.value);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    extra.push({ value: r.value, label: r.label, source: "google" });
  }
  return [...local, ...extra];
}

/**
 * Hybrid city suggestions: known curated/DB names first, then Google Places (LK)
 * when the query is at least 2 characters.
 */
export function useCitySuggestions(known: readonly string[], query: string | null) {
  const term = (query ?? "").trim();
  const [remote, setRemote] = useState<PlaceSuggestion[]>([]);
  const [placesConfigured, setPlacesConfigured] = useState(true);

  useEffect(() => {
    if (term.length < 2) return;
    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(term)}`, {
            signal: ac.signal,
          });
          if (!res.ok) {
            setRemote([]);
            return;
          }
          const data = (await res.json()) as {
            cities?: PlaceSuggestion[];
            configured?: boolean;
          };
          if (data.configured === false) setPlacesConfigured(false);
          setRemote(data.cities ?? []);
        } catch (e) {
          if ((e as { name?: string })?.name === "AbortError") return;
          setRemote([]);
        }
      })();
    }, 280);
    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  const suggestions = useMemo(
    () => merge(known, term.length < 2 ? [] : remote, term),
    [known, remote, term],
  );

  return { suggestions, placesConfigured };
}
