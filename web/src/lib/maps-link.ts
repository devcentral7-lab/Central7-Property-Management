/** Google Maps share links pasted into a listing's "Location" field. */

export type MapsLinkResult = { ok: true; url: string | null } | { ok: false; error: string };

const MAX_LENGTH = 2000;
const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/i;
const BARE_MAPS_HOST = /^(maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.|maps\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)/i;
const GOOGLE_HOST = /^(?:www\.|maps\.)?google\.[a-z]{2,3}(?:\.[a-z]{2})?$/i;

export const MAPS_LINK_ERROR = "Paste a Google Maps link (e.g. https://maps.app.goo.gl/…).";

function isGoogleMapsUrl(u: URL): boolean {
  const host = u.hostname.toLowerCase();
  if (host === "maps.app.goo.gl" || host === "g.co") return true;
  if (host === "goo.gl") return u.pathname.startsWith("/maps");
  if (!GOOGLE_HOST.test(host)) return false;
  return host.startsWith("maps.") || u.pathname.startsWith("/maps");
}

/**
 * Finds the link in whatever was pasted — a bare URL, a URL without `https://`,
 * or share text like "Check out this place https://maps.app.goo.gl/…".
 * Empty input is valid (no location).
 */
export function parseMapsLink(raw: string): MapsLinkResult {
  const text = raw.trim();
  if (!text) return { ok: true, url: null };

  let candidate = text.match(URL_IN_TEXT)?.[0];
  if (!candidate && BARE_MAPS_HOST.test(text)) candidate = `https://${text.split(/\s/)[0]}`;
  if (!candidate) return { ok: false, error: MAPS_LINK_ERROR };
  candidate = candidate.replace(/[),.;!?]+$/, "");

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: MAPS_LINK_ERROR };
  }
  if (!/^https?:$/.test(url.protocol) || !isGoogleMapsUrl(url)) {
    return { ok: false, error: MAPS_LINK_ERROR };
  }
  const href = url.toString();
  if (href.length > MAX_LENGTH) return { ok: false, error: "That link is too long." };
  return { ok: true, url: href };
}
