/** City names from the legacy data/raw/City.json export, sorted alphabetically. */
export const LEGACY_CITIES: readonly string[] = [
  "Akkaraipattu",
  "Akuressa",
  "Aluthgama",
  "Ambalangoda",
  "Ampara",
  "Ampitiya",
  "Angoda",
  "Anuradhapura",
  "Arugam Bay",
  "Athurugiriya",
  "Avissawella",
  "Badulla",
  "Balangoda",
  "Bandarawela",
  "Battaramulla",
  "Batticaloa",
  "Bentota",
  "Beruwala",
  "Boralesgamuwa",
  "Chilaw",
  "Colombo 01",
  "Colombo 02",
  "Colombo 03",
  "Colombo 04",
  "Colombo 05",
  "Colombo 06",
  "Colombo 07",
  "Colombo 08",
  "Colombo 09",
  "Colombo 10",
  "Colombo 11",
  "Colombo 12",
  "Colombo 13",
  "Colombo 14",
  "Colombo 15",
  "Dambadeniya",
  "Dambulla",
  "Dehiwala",
  "Divulapitiya",
  "Diyatalawa",
  "Ella",
  "Embilipitiya",
  "Ethul Kotte",
  "Galle",
  "Gampaha",
  "Gampola",
  "Hambantota",
  "Hanwella",
  "Haputale",
  "Hatton",
  "Hikkaduwa",
  "Hiriketiya",
  "Hokandara",
  "Homagama",
  "Ja-ela",
  "Jaffna",
  "Kadawatha",
  "Kaduwela",
  "Kalmunai",
  "Kalpitiya",
  "Kalubowila",
  "Kalutara",
  "Kandana",
  "Kandy",
  "Katugastota",
  "Katunayake",
  "Kegalle",
  "Kelaniya",
  "Kesbewa",
  "Kiribathgoda",
  "Kirindiwela",
  "Kithulgala",
  "Kohuwala",
  "Kollupitiya",
  "Kolonnawa",
  "Koswatte",
  "Kottawa",
  "Kotte",
  "Kuliyapitiya",
  "Kurunegala",
  "Madiwela",
  "Mahabage",
  "Maharagama",
  "Malabe",
  "Mannar",
  "Matale",
  "Matara",
  "Mawanella",
  "Meegoda",
  "Meerigama",
  "Minuwangoda",
  "Mirigama",
  "Mirissa",
  "Monaragala",
  "Moratuwa",
  "Mt. Lavinia",
  "Narammala",
  "Nawala",
  "Negombo",
  "Nugegoda",
  "Nuwara Eliya",
  "Other",
  "Pamankada",
  "Panadura",
  "Pannipitiya",
  "Pelawatta",
  "Peliyagoda",
  "Pepiliyana",
  "Piliyandala",
  "Polonnaruwa",
  "Pottuvil",
  "Puttalam",
  "Ragama",
  "Rajagiriya",
  "Rambukkana",
  "Ratmalana",
  "Ratnapura",
  "Seeduwa",
  "Seethawaka",
  "Tangalle",
  "Thalahena",
  "Thalawathugoda",
  "Tissamaharama",
  "Trincomalee",
  "Uswetakeiyawa",
  "Vavuniya",
  "Veyangoda",
  "Wadduwa",
  "Wattala",
  "Weligama",
  "Welisara",
  "Wellawaya",
];

/** app_settings key for the admin-edited city list; until it is saved, LEGACY_CITIES is used. */
export const CITIES_SETTING_KEY = "cities";

export function cleanCityName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function cityKey(raw: string): string {
  return cleanCityName(raw).toLowerCase();
}

/** "Colombo 4", "colombo-04" and "COLOMBO 04" share a key. */
function matchKey(raw: string): string {
  return cleanCityName(raw)
    .toLowerCase()
    .replace(/\d+/g, (d) => String(Number(d)))
    .replace(/[^a-z0-9]/g, "");
}

function words(raw: string): string {
  return ` ${raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

/**
 * Maps free-text place names onto names from `list`, plus any list names and
 * "Colombo 4, 5, 6" shorthand written in `text`. "Other" is never matched.
 */
export function matchCities(
  candidates: readonly string[],
  list: readonly string[],
  text = "",
): string[] {
  const usable = list.filter((c) => c !== "Other");
  const byKey = new Map(usable.map((c) => [matchKey(c), c]));
  const found = new Set<string>();
  const add = (raw: string) => {
    const hit = byKey.get(matchKey(raw));
    if (hit) found.add(hit);
  };

  candidates.forEach(add);

  for (const m of text.matchAll(/colombo[\s-]*(\d{1,2}(?:\s*(?:,|\/|&|and)\s*\d{1,2})*)/gi)) {
    for (const n of m[1].match(/\d{1,2}/g) ?? []) add(`Colombo ${n}`);
  }

  const haystack = words(text);
  const named = usable.filter((c) => !/^colombo\W*\d/i.test(c) && haystack.includes(words(c)));
  for (const c of named) {
    if (!named.some((o) => o !== c && words(o).includes(words(c)))) found.add(c);
  }

  return [...found];
}

export function sortCities(list: readonly string[]): string[] {
  return [...list].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
