/** Matching free-text from listing notes onto admin-managed lists (amenities, complexes). */

function key(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

function words(raw: string): string {
  return ` ${raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/** Common ways notes describe the default amenities, keyed by `key()` of the alias. */
const AMENITY_ALIASES: Record<string, string> = {
  pool: "swimmingpool",
  swimming: "swimmingpool",
  ac: "airconditioning",
  aircon: "airconditioning",
  airconditioned: "airconditioning",
  airconditioner: "airconditioning",
  airconditioners: "airconditioning",
  fullyairconditioned: "airconditioning",
  lift: "liftelevator",
  lifts: "liftelevator",
  elevator: "liftelevator",
  elevators: "liftelevator",
  gymnasium: "gym",
  fitnesscentre: "gym",
  fitnesscenter: "gym",
  garden: "gardenspace",
  roofterrace: "rooftop",
  rooftopterrace: "rooftop",
  gamesroom: "rumpusroom",
  gameroom: "rumpusroom",
  maidroom: "maidsroom",
  maidsroom: "maidsroom",
  maidstoilet: "maidstoilet",
  maidtoilet: "maidstoilet",
  servantroom: "servantquarters",
  servantsquarters: "servantquarters",
  solar: "solarpanels",
  solarpower: "solarpanels",
  solarpanel: "solarpanels",
  backupgenerator: "generator",
  standbygenerator: "generator",
  securitycameras: "cctv",
  balconies: "balcony",
  carporch: "garage",
  study: "studyroom",
  storeroom: "storeroom",
  store: "storeroom",
  oceanview: "seaview",
  watertanks: "watertank",
  bar: "bararea",
};

/**
 * Splits extracted amenities into names from `list` (canonical spelling) and
 * leftover extras for the free-text field.
 */
export function matchAmenities(
  parts: readonly string[],
  list: readonly string[],
): { matched: string[]; extras: string[] } {
  const byKey = new Map(list.map((a) => [key(a), a]));
  const matched = new Set<string>();
  const extras: string[] = [];
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const k = key(part);
    const hit = byKey.get(k) ?? byKey.get(AMENITY_ALIASES[k] ?? "");
    if (hit) matched.add(hit);
    else if (!extras.some((e) => key(e) === k)) extras.push(part);
  }
  return { matched: [...matched], extras };
}

export type NamedOption = { id: string; name: string; location?: string | null };

/** Exact name first, then an unambiguous partial match ("Altair" ↔ "Altair Residencies"). */
function complexByName(candidate: string, complexes: readonly NamedOption[]): NamedOption | null {
  const c = key(candidate);
  if (c.length < 3) return null;
  const exact = complexes.find((x) => key(x.name) === c);
  if (exact) return exact;
  const partial = complexes.filter((x) => {
    const k = key(x.name);
    return k.length >= 3 && (k.includes(c) || c.includes(k));
  });
  return partial.length === 1 ? partial[0] : null;
}

/**
 * Every complex the notes refer to: the extracted names plus complex names
 * written in `text` (a name inside a longer matched name is ignored).
 */
export function matchComplexes(
  candidates: readonly string[],
  complexes: readonly NamedOption[],
  text = "",
): NamedOption[] {
  const found = new Map<string, NamedOption>();
  for (const c of candidates) {
    const hit = complexByName(c, complexes);
    if (hit) found.set(hit.id, hit);
  }
  const haystack = words(text);
  const named = complexes.filter((x) => key(x.name).length >= 4 && haystack.includes(words(x.name)));
  for (const x of named) {
    if (!named.some((o) => o !== x && words(o.name).includes(words(x.name)))) found.set(x.id, x);
  }
  return [...found.values()];
}
