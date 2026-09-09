/**
 * Clean legacy property (+ lookup) rows into data/clean/
 * Usage: npm run migrate:clean
 */
import fs from 'node:fs';
import {
  CONTACT_TYPES,
  FURNISHED_LIST,
  OPPORTUNITY_TYPES,
  PROPERTY_TYPES,
  STATUS_LIST,
  type PropertyType,
} from './constants.js';
import {
  coerceTimestamp,
  dataPath,
  formatContactNumber,
  parseNumber,
  parseRefSeq,
  readJsonFile,
  s,
  splitAmenities,
  writeJsonFile,
} from './utils.js';

type Row = Record<string, unknown>;

function loadRaw(slug: string): Row[] {
  const file = dataPath('raw', `${slug}.json`);
  if (!fs.existsSync(file)) return [];
  const data = readJsonFile<unknown>(file);
  return Array.isArray(data) ? (data as Row[]) : [];
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function pickLandSize(row: Row, type: PropertyType | null): number | null {
  if (type === 'Land') return parseNumber(row['land Size (perch)_1']);
  if (type === 'Commercial Property') return parseNumber(row['Size of Land (Perch)']);
  return parseNumber(row['land Size (perch)']) ?? parseNumber(row['land Size (perch)_1']);
}

function pickBeds(row: Row, type: PropertyType | null): number | null {
  if (type === 'Apartment') return parseNumber(row['Number of Rooms']);
  return parseNumber(row['Bed Rooms']) ?? parseNumber(row['Number of Rooms']);
}

function pickBaths(row: Row, type: PropertyType | null): number | null {
  if (type === 'Apartment') return parseNumber(row['Number of Bath Rooms']);
  return parseNumber(row['Bath Rooms']) ?? parseNumber(row['Number of Bath Rooms']);
}

function pickFloorArea(row: Row, type: PropertyType | null): number | null {
  if (type === 'Apartment') return parseNumber(row['Floor Area (sqft)_1']);
  if (type === 'Commercial Property') {
    return parseNumber(row['Built up Area']) ?? parseNumber(row['Floor Area (sqft)']);
  }
  return parseNumber(row['Floor Area (sqft)']) ?? parseNumber(row['Floor Area (sqft)_1']);
}

function pickParking(row: Row, type: PropertyType | null): number | null {
  if (type === 'Apartment') return parseNumber(row['Dedicated Parking Slots']);
  return (
    parseNumber(row['Parking Space (No of vehicles)']) ??
    parseNumber(row['Dedicated Parking Slots'])
  );
}

function mergeComments(row: Row): string {
  return [
    s(row['Other information']),
    s(row['Other information_1']),
    s(row['Comments']),
    s(row['Comments_1']),
    s(row['Comments_2']),
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join('\n')
    .trim();
}

function cleanProperty(row: Row): Record<string, unknown> | null {
  const refNo = s(row['Ref No']).toUpperCase();
  const refSeq = parseRefSeq(refNo);
  if (!refNo || refSeq === null) return null;

  const propertyType = oneOf(s(row['Property Type']), PROPERTY_TYPES);
  const opportunityType = oneOf(s(row['Opportunity Type']), OPPORTUNITY_TYPES);
  const status = oneOf(s(row['Status']), STATUS_LIST) ?? 'Active';
  const contactType = oneOf(s(row['Type of Contact (Direct/ Partner)']), CONTACT_TYPES);
  const furnished = oneOf(s(row['Furnished']), FURNISHED_LIST);
  const currencyRaw = s(row['Currency']).toUpperCase();
  const currency = currencyRaw === 'USD' ? 'USD' : 'LKR';

  const purpose = s(row['Purpose']) || s(row['Purpose_1']) || null;
  const amenities = splitAmenities(
    row['Other Amenities'],
    row['Other Amenities_1'],
    row['Other Amenities_2'],
  );

  const typeAttributes: Record<string, unknown> = {};
  if (s(row['Suitable for'])) typeAttributes.suitable_for = s(row['Suitable for']);
  if (s(row['View'])) typeAttributes.view = s(row['View']);
  if (s(row['Built up Area'])) typeAttributes.built_up_area = parseNumber(row['Built up Area']);
  if (s(row['Apartment Complex'])) typeAttributes.apartment_complex_name = s(row['Apartment Complex']);

  return {
    ref_no: refNo,
    ref_seq: refSeq,
    created_at: coerceTimestamp(row['Timestamp']),
    created_by_name: s(row['User']) || null,
    contact_type: contactType,
    contact_name: s(row['Name of Contact']) || 'Unknown',
    contact_phone_1: formatContactNumber(row['Contact No 1']) || 'unknown',
    contact_phone_2: formatContactNumber(row['Contact No 2']) || null,
    contact_email: s(row['Email']) || null,
    opportunity_type: opportunityType ?? 'Sell',
    property_type: propertyType ?? 'House',
    purpose,
    property_subtype: s(row['Property Sub-type']) || null,
    address: s(row['Address']) || null,
    city_name: s(row['City']) || null,
    land_size_perch: pickLandSize(row, propertyType),
    floor_area_sqft: pickFloorArea(row, propertyType),
    bedrooms: pickBeds(row, propertyType),
    bathrooms: pickBaths(row, propertyType),
    floors: parseNumber(row['No of Floors']),
    parking_spaces: pickParking(row, propertyType),
    age_years: parseNumber(row['Age of the House']),
    apartment_floor: s(row['Floor']) || null,
    currency,
    price_per_perch: parseNumber(row['Price per Perch']),
    price_per_sqft: parseNumber(row['Price per sqft']),
    price_total: parseNumber(row['Price Total']),
    budget: parseNumber(row['Budget']),
    furnished,
    status,
    do_not_publish: false,
    amenities,
    comments: mergeComments(row) || null,
    type_attributes: typeAttributes,
  };
}

function main(): void {
  const rawProps = loadRaw('C7_Pulse_DB_Dev');
  const cleaned: Record<string, unknown>[] = [];
  const rejected: Row[] = [];
  const seen = new Map<string, Record<string, unknown>>();

  for (const row of rawProps) {
    const item = cleanProperty(row);
    if (!item) {
      rejected.push({ reason: 'bad_ref', row });
      continue;
    }
    const key = String(item.ref_no);
    const prev = seen.get(key);
    if (!prev) {
      seen.set(key, item);
      continue;
    }
    // Keep newer created_at when duplicate Ref No
    const prevTs = Date.parse(String(prev.created_at ?? '')) || 0;
    const nextTs = Date.parse(String(item.created_at ?? '')) || 0;
    if (nextTs >= prevTs) seen.set(key, item);
    rejected.push({ reason: 'duplicate_ref', ref_no: key });
  }

  cleaned.push(...seen.values());
  cleaned.sort((a, b) => Number(a.ref_seq) - Number(b.ref_seq));

  const cities = [
    ...new Set(
      cleaned.map((r) => s(r.city_name)).filter(Boolean),
    ),
  ].map((name) => ({ name }));

  const complexes = [
    ...new Set(
      cleaned
        .map((r) => s((r.type_attributes as Row)?.apartment_complex_name))
        .filter(Boolean),
    ),
  ].map((name) => ({ name }));

  writeJsonFile(dataPath('clean', 'properties.json'), cleaned);
  writeJsonFile(dataPath('clean', 'cities.json'), cities);
  writeJsonFile(dataPath('clean', 'apartment_complexes.json'), complexes);
  writeJsonFile(dataPath('rejected', 'properties.json'), rejected);

  console.log(
    `Cleaned properties: ${cleaned.length}; rejected: ${rejected.length}; cities: ${cities.length}; complexes: ${complexes.length}`,
  );
}

main();
