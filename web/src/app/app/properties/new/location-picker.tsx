"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 6.9271, lng: 79.8612 };

type LatLng = { lat: number; lng: number };
type GLatLng = { lat(): number; lng(): number };
type GMap = {
  panTo(p: LatLng): void;
  setZoom(z: number): void;
  addListener(event: string, fn: (e: { latLng?: GLatLng | null }) => void): unknown;
};
type GMarker = {
  setPosition(p: LatLng | null): void;
  getPosition(): GLatLng | null | undefined;
  addListener(event: string, fn: () => void): unknown;
};
type GoogleGlobal = {
  maps?: { importLibrary(name: string): Promise<unknown> };
};
type MapsLibrary = { Map: new (el: HTMLElement, opts: object) => GMap };
type MarkerLibrary = { Marker: new (opts: object) => GMarker };
type AddressComponent = { long_name: string; short_name: string; types: string[] };
type GeocoderResult = { address_components: AddressComponent[] };
type GeocodingLibrary = {
  Geocoder: new () => {
    geocode(req: { location: LatLng }): Promise<{ results: GeocoderResult[] }>;
  };
};

/** Google's names → the spellings already used in listings. */
const CITY_ALIASES: Record<string, string> = {
  "mount lavinia": "Mt. Lavinia",
  "dehiwala-mount lavinia": "Dehiwala",
  "ja-ela": "Ja-ela",
  "sri jayawardenepura kotte": "Kotte",
};

/** Municipalities too broad to be useful; prefer the neighbourhood inside them. */
const BROAD_LOCALITIES = new Set([
  "sri jayawardenepura kotte",
  "dehiwala-mount lavinia",
]);

function normalizeCity(name: string) {
  return CITY_ALIASES[name.toLowerCase()] ?? name;
}

function firstOfType(components: AddressComponent[], types: string[]) {
  for (const type of types) {
    const c = components.find((x) => x.types.includes(type));
    if (c) return c.long_name;
  }
  return null;
}

function colomboZone(components: AddressComponent[]): string | null {
  for (const c of components) {
    const m = c.long_name.match(/^colombo\s*0?(\d{1,2})$/i);
    if (m) return `Colombo ${m[1].padStart(2, "0")}`;
  }
  const inColombo = components.some(
    (c) => c.types.includes("locality") && /^colombo$/i.test(c.long_name),
  );
  const postal = components.find((c) => c.types.includes("postal_code"));
  const m = postal?.long_name.match(/^0(\d{2})00$/);
  if (inColombo && m && Number(m[1]) >= 1 && Number(m[1]) <= 15) {
    return `Colombo ${m[1]}`;
  }
  return null;
}

function cityFromGeocode(results: GeocoderResult[]): string | null {
  const components = results.slice(0, 3).flatMap((r) => r.address_components);
  const zone = colomboZone(components);
  if (zone) return zone;

  const locality = firstOfType(components, ["locality"]);
  if (locality && !BROAD_LOCALITIES.has(locality.toLowerCase())) {
    return normalizeCity(locality);
  }
  const area = firstOfType(components, [
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
  ]);
  if (area) return normalizeCity(area);
  if (locality) return normalizeCity(locality);

  const fallback = firstOfType(components, [
    "postal_town",
    "administrative_area_level_2",
  ]);
  return fallback ? normalizeCity(fallback) : null;
}

async function reverseGeocodeCity(p: LatLng): Promise<string | null> {
  const google = (window as unknown as { google?: Required<GoogleGlobal> })
    .google;
  if (!google?.maps?.importLibrary) return null;
  const { Geocoder } = (await google.maps.importLibrary(
    "geocoding",
  )) as GeocodingLibrary;
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => resolve(null), 6000),
  );
  const lookup = new Geocoder()
    .geocode({ location: p })
    .then((r) => cityFromGeocode(r.results));
  return Promise.race([lookup, timeout]);
}

let mapsLoader: Promise<void> | null = null;

function loadGoogleMaps(key: string): Promise<void> {
  const g = (window as unknown as { google?: GoogleGlobal }).google;
  if (g?.maps?.importLibrary) return Promise.resolve();
  if (!mapsLoader) {
    mapsLoader = new Promise<void>((resolve, reject) => {
      const callbackName = "__c7GoogleMapsReady";
      (window as unknown as Record<string, unknown>)[callbackName] = () =>
        resolve();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${callbackName}`;
      script.async = true;
      script.onerror = () => {
        mapsLoader = null;
        script.remove();
        reject(new Error("Could not load Google Maps."));
      };
      document.head.appendChild(script);
    });
  }
  return mapsLoader;
}

function parseCoord(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

function PinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z"
      />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

function MapDialog({
  initial,
  onClose,
  onSave,
}: {
  initial: LatLng | null;
  onClose: () => void;
  onSave: (p: LatLng, city: string | null) => void;
}) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const [start] = useState(initial);
  const [picked, setPicked] = useState<LatLng | null>(initial);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    MAPS_KEY ? "loading" : "error",
  );
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function savePin() {
    if (!picked) return;
    setSaving(true);
    const city = await reverseGeocodeCity(picked).catch(() => null);
    setSaving(false);
    onSave(picked, city);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    if (!MAPS_KEY) return;
    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMaps(MAPS_KEY);
        const google = (window as unknown as { google: Required<GoogleGlobal> })
          .google;
        const { Map } = (await google.maps.importLibrary("maps")) as MapsLibrary;
        const { Marker } = (await google.maps.importLibrary(
          "marker",
        )) as MarkerLibrary;
        if (cancelled || !mapEl.current) return;

        const map = new Map(mapEl.current, {
          center: start ?? DEFAULT_CENTER,
          zoom: start ? 16 : 11,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        const marker = new Marker({
          map,
          position: start,
          draggable: true,
        });

        map.addListener("click", (e) => {
          if (!e.latLng) return;
          const p = { lat: round(e.latLng.lat()), lng: round(e.latLng.lng()) };
          marker.setPosition(p);
          setPicked(p);
        });
        marker.addListener("dragend", () => {
          const pos = marker.getPosition();
          if (pos) setPicked({ lat: round(pos.lat()), lng: round(pos.lng()) });
        });

        mapRef.current = map;
        markerRef.current = marker;
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Could not load Google Maps.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [start]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This device can't share its location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = {
          lat: round(pos.coords.latitude),
          lng: round(pos.coords.longitude),
        };
        markerRef.current?.setPosition(p);
        mapRef.current?.panTo(p);
        mapRef.current?.setZoom(17);
        setPicked(p);
      },
      () => {
        setLocating(false);
        setError("Couldn't get your current location.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-stretch justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close map"
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pin location on map"
        className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-[var(--bg)] shadow-2xl sm:h-auto sm:max-w-3xl sm:rounded-2xl sm:border sm:border-[var(--line)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] bg-[var(--card)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:pt-3">
          <h2 className="font-display text-lg font-semibold">Pin location</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-accent)] sm:px-3 sm:py-1.5"
          >
            Close
          </button>
        </div>

        {MAPS_KEY ? (
          <div className="relative min-h-0 flex-1 sm:h-[460px] sm:flex-none">
            <div ref={mapEl} className="absolute inset-0" />
            {status === "loading" ? (
              <div className="skeleton absolute inset-0 rounded-none" />
            ) : null}
            {status === "error" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--card)] p-6 text-center text-sm text-[var(--danger)]">
                {error}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-[var(--card)] p-8 text-center sm:h-[300px] sm:flex-none">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-accent)] text-[var(--brand)]">
              <PinIcon className="h-6 w-6" />
            </span>
            <p className="font-semibold">Map pinning is coming soon</p>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Google Maps isn&apos;t connected yet. You can save this listing as
              usual — any location already on it is kept.
            </p>
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--card)] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <p className="text-sm text-[var(--muted)]">
            {MAPS_KEY
              ? picked
                ? `${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}`
                : "Tap the map to drop a pin"
              : picked
                ? `Current: ${picked.lat.toFixed(6)}, ${picked.lng.toFixed(6)}`
                : "No location pinned"}
            {MAPS_KEY && error && status === "ready" ? (
              <span className="block text-xs text-[var(--danger)]">{error}</span>
            ) : null}
          </p>
          {MAPS_KEY ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={useMyLocation}
                disabled={status !== "ready" || locating}
                className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium hover:bg-[var(--bg-accent)] disabled:opacity-50"
              >
                {locating ? "Locating…" : "Use my location"}
              </button>
              <button
                type="button"
                onClick={savePin}
                disabled={!picked || status !== "ready" || saving}
                className="rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-deep)] disabled:opacity-50"
              >
                {saving ? "Finding city…" : "Save pin"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Map pin field. Always submits `latitude` / `longitude` as hidden inputs so
 * existing coordinates survive saves even while Google Maps isn't configured.
 */
export function LocationPickerField({
  latitude,
  longitude,
  onChange,
  className = "",
}: {
  latitude: string;
  longitude: string;
  /** `city` is the reverse-geocoded city, or null when unknown / not looked up. */
  onChange: (latitude: string, longitude: string, city: string | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [cityNote, setCityNote] = useState<string | null>(null);
  const lat = parseCoord(latitude);
  const lng = parseCoord(longitude);
  const pinned = lat != null && lng != null ? { lat, lng } : null;

  return (
    <div className={`min-w-0 ${className}`}>
      <span className="block text-[13px] font-medium text-[var(--ink)]">
        Map pin
      </span>
      <div className="mt-1.5 flex min-h-[38px] flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[var(--line)] bg-white px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-white hover:bg-[var(--brand-deep)]"
        >
          <PinIcon className="h-3.5 w-3.5" />
          {pinned ? "Update pin" : "Pin on Google Maps"}
        </button>
        <span className="min-w-0 truncate text-sm font-normal text-[var(--muted)]">
          {pinned
            ? `${pinned.lat.toFixed(6)}, ${pinned.lng.toFixed(6)}`
            : "No location pinned"}
        </span>
        {pinned ? (
          <button
            type="button"
            onClick={() => {
              onChange("", "", null);
              setCityNote(null);
            }}
            className="ml-auto text-xs font-semibold text-[var(--muted)] hover:text-[var(--danger)] hover:underline"
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs text-[var(--muted)]">
        {cityNote && pinned ? (
          <>
            City set to <strong>{cityNote}</strong> from the pin.
          </>
        ) : (
          "Drop a pin on Google Maps for the exact spot."
        )}
      </p>
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />

      {open
        ? createPortal(
            <MapDialog
              initial={pinned}
              onClose={() => setOpen(false)}
              onSave={(p, city) => {
                onChange(String(p.lat), String(p.lng), city);
                setCityNote(city);
                setOpen(false);
              }}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
