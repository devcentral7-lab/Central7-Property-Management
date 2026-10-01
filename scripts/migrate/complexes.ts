/** Apartment complex naming rules shared by the cleanup migration and the legacy sync. */
import { coerceTimestamp, s } from './utils.js';

type Row = Record<string, unknown>;

/** Values staff picked on listings that are not a building; those listings get no complex. */
export const COMPLEX_PLACEHOLDERS = new Set(['any', 'other', 'no name']);

/** Development names used on listings where legacy has one entry per tower; kept as their own complex. */
export const COMPLEX_GROUPS: Record<string, string> = {
  'Havelock City': 'Colombo-05',
  'Cinnamon Life': 'Colombo-02',
  Altair: 'Colombo-02',
  Iconic: 'Rajagiriya',
  'Capitol Twin Peaks': 'Colombo-02',
};

/** Old / free-typed listing names → the legacy table name (or a group above). */
export const COMPLEX_ALIASES: Record<string, string> = {
  On320: 'On320 Residencies',
  'OnThree20 Residencies': 'On320 Residencies',
  '7th sense': '7th Sense Apartments',
  Monarch: 'Monarch Apartments',
  Crescat: 'Crescat Residencies',
  Fairmount: 'Fairmount Residencies',
  'Grandsburg Colombo 7': 'Grandsburg',
  'Verge Apartment -': 'Verge Apartment',
  'Verge Apartment - Rajagiriya': 'Verge Apartment',
  'Flemington -': 'Flemington',
  'Flemington - Rajagiriya': 'Flemington',
  'Prime Residencies - 194 Nugegoda': 'Prime Residencies - 194',
  'Prime Residencies - 198 Nugegoda': 'Prime Residencies - 198',
  'Prime Residencies - 298 Nugegoda': 'Prime Residencies - 298',
  'Prime Residencies - Splendour Rajagiriya': 'Prime Residencies - Splendour',
  'Prime Residencies - Kottawa': 'Prime Residencies',
  'Vantage Apartments - Nugegoda': 'Vantage Apartments',
  'Urban Heights - Wattala By Kelsey': 'Urban Heights',
  'Astoria - Colombo 03': 'Astoria Apartments',
  'Hampden Tower - Colombo 04': 'Hampden Tower',
  'Castle Skyline Residence - Colombo 04': 'Castle Skyline Residence',
  'Castel Residencies, Sky Line': 'Castle Skyline Residence',
  'Triilium Colombo 7 - Torrington Avenue': 'Triilium, Torrington Avenue',
  'Sheratan Plaza - Dehiwala': 'Sheratan Plaza',
  'Gandhi Arcadia - Colombo 06': 'Gandhi Arcadia',
  'Capitol Elite Apartments (Horton Place)': 'Capitol Elite Apartments, Horton Place',
  'Colombo City Center (CCC)': 'Colombo City Centre (CCC)',
  'One Galle Face (Shangri-la)': 'Shangri La Residences',
  'Altair Straight Tower': 'Altair-Straight Tower',
  'Capitol TwinPeaks': 'Capitol Twin Peaks',
};

const LOCATION_FIXES: Record<string, string> = { wattaka: 'Wattala' };

export function tidyName(v: unknown): string {
  return s(v).replace(/\s+/g, ' ');
}

const key = (name: string) => tidyName(name).toLowerCase();

export function normalizeLocation(v: unknown): string | null {
  const raw = tidyName(v);
  if (!raw) return null;
  const colombo = /^colombo[\s-]*0?(\d{1,2})$/i.exec(raw);
  if (colombo) return `Colombo-${colombo[1].padStart(2, '0')}`;
  return LOCATION_FIXES[raw.toLowerCase()] ?? raw;
}

export type CleanComplex = {
  name: string;
  location: string | null;
  amenities: string[];
  added_by: string | null;
  created_at: string | null;
  address: string | null;
  built_year: number | null;
};

export function cleanLegacyComplex(row: Row): CleanComplex {
  const year = /^\d{4}$/.exec(s(row['Built on']));
  return {
    name: tidyName(row['Name']),
    location: normalizeLocation(row['Location']),
    amenities: [...new Set(s(row['Default Amenities']).split(',').map((a) => tidyName(a)).filter(Boolean))],
    added_by: tidyName(row['Added By']) || null,
    created_at: coerceTimestamp(row['Created At']),
    address: tidyName(row['Address']) || null,
    built_year: year ? Number(year[0]) : null,
  };
}

/**
 * Maps any complex name (legacy table, listing, or DB) to the name it should be
 * stored under: null for placeholders, the legacy/group name for known variants
 * (case-insensitive), otherwise the tidied name itself.
 */
export function complexNameResolver(legacyNames: Iterable<string>): (name: unknown) => string | null {
  const canonical = new Map<string, string>();
  for (const n of legacyNames) if (tidyName(n)) canonical.set(key(n), tidyName(n));
  for (const n of Object.keys(COMPLEX_GROUPS)) canonical.set(key(n), n);
  const aliases = new Map(Object.entries(COMPLEX_ALIASES).map(([from, to]) => [key(from), to]));
  return (name) => {
    const k = key(s(name));
    if (!k || COMPLEX_PLACEHOLDERS.has(k)) return null;
    const target = aliases.get(k);
    if (target) return canonical.get(key(target)) ?? target;
    return canonical.get(k) ?? tidyName(name);
  };
}
