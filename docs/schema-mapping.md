# Schema mapping — legacy → optimized

Source: `C7_Pulse_DB_Dev` / Code.gs `PROPERTY_COLUMN_NAMES` + related tables.
Target: new Supabase schema in `supabase/migrations/0001_init.sql`.

## Properties (`C7_Pulse_DB_Dev` → `properties`)

| Legacy column | New column / path | Notes |
|---|---|---|
| `Ref No` | `ref_no` + `ref_seq` | Parse `C7-{n}` → integer `ref_seq` |
| `Timestamp` | `created_at` | Coerce to `timestamptz` |
| `User` | `created_by_name` (+ resolve `created_by` → `profiles`) | Staff display name |
| `Type of Contact (Direct/ Partner)` | `contact_type` | Enum Direct/Partner |
| `Name of Contact` | `contact_name` | Required |
| `Contact No 1` | `contact_phone_1` | Normalize `0…` / `00…` |
| `Contact No 2` | `contact_phone_2` | |
| `Email` | `contact_email` | |
| `Opportunity Type` | `opportunity_type` | Sell / Rent Out |
| `Property Type` | `property_type` | House/Land/Apartment/Commercial Property/Estate |
| `Purpose` | `purpose` | House/Estate primary purpose |
| `Property Sub-type` | `property_subtype` | Unused in Code.gs writes; keep nullable |
| `Address` | `address` | |
| `City` | `city_name` + `city_id` | Resolve/create `cities` |
| `land Size (perch)` | `land_size_perch` | House/Estate |
| `Bed Rooms` | `bedrooms` | House/Estate |
| `Bath Rooms` | `bathrooms` | House/Estate |
| `Floor Area (sqft)` | `floor_area_sqft` | House/Estate |
| `No of Floors` | `floors` | |
| `Parking Space (No of vehicles)` | `parking_spaces` | House/Estate |
| `Age of the House` | `age_years` | |
| `Other Amenities` | `amenities` (text[]) | Split on comma; merge free text |
| `Other information` | `comments` or `type_attributes.other_information` | Prefer consolidate into `comments` |
| `land Size (perch)_1` | `land_size_perch` | Land type |
| `Suitable for` | `type_attributes.suitable_for` | Land |
| `Other Amenities_1` | `amenities` | Land |
| `Other information_1` | merge → `comments` | Land |
| `Apartment Complex` | `apartment_complex_id` + name in attributes | Resolve `apartment_complexes` |
| `Floor` | `apartment_floor` | Apartment |
| `Number of Rooms` | `bedrooms` | Apartment |
| `Number of Bath Rooms` | `bathrooms` | Apartment |
| `Floor Area (sqft)_1` | `floor_area_sqft` | Apartment |
| `Dedicated Parking Slots` | `parking_spaces` | Apartment |
| `View` | `type_attributes.view` | Apartment |
| `Other Amenities_2` | `amenities` | Apartment |
| `Comments` | merge → `comments` | Apartment cluster |
| `Purpose_1` | `purpose` | Commercial |
| `Size of Land (Perch)` | `land_size_perch` | Commercial |
| `Built up Area` | `floor_area_sqft` + `type_attributes.built_up_area` | Commercial |
| `Comments_1` | merge → `comments` | Commercial |
| `Currency` | `currency` | LKR/USD |
| `Price per Perch` | `price_per_perch` | numeric |
| `Price per sqft` | `price_per_sqft` | numeric |
| `Price Total` | `price_total` | numeric |
| `Budget` | `budget` | numeric |
| `Comments_2` | merge → `comments` | Pricing cluster comments |
| `Furnished` | `furnished` | enum |
| `Status` | `status` | listing_status enum |
| `id` | ignored | New UUID PK |
| `Do Not Publish` | `do_not_publish` | Often missing in legacy; default false. Form flag in GAS |
| `Agent Ref No` | **omit** | Unused in Code.gs |
| `Internal Comments` | **omit** | Unused in Code.gs |

### `type_attributes` JSON shape (by property_type)

```json
{
  "suitable_for": "",
  "view": "",
  "built_up_area": null,
  "other_information": "",
  "legacy_extras": {}
}
```

Estate uses the same core columns as House.

---

## Users (`User` → `profiles` + Auth)

| Legacy | New |
|---|---|
| `Name` | `profiles.display_name` |
| `Mobile Number` | `profiles.mobile_number` |
| `Role` | `profiles.role` (Admin/User) |
| `Photo` | `profiles.photo_drive_id` |
| `Created At` | `profiles.created_at` |
| `Password` | **not migrated** — Supabase Auth invite/reset |
| `WebAuthn Credentials` | unused in Code.gs — drop |
| `Active` | `profiles.active` |
| `User` | ignore duplicate |
| `id` | ignore — new UUID = `auth.users.id` |

---

## Agents

| Legacy | New |
|---|---|
| `Company Name` | `company_name` |
| `Contact Person` | `contact_person` |
| `Contact Number` | `contact_number` |
| `Email` | `email` |
| `Registered Address` | `registered_address` |
| `Username` | `username` |
| `Password` | Auth only — invite/reset |
| `Status` | `status` enum |
| `Active` | `active` boolean (coerce from text) |
| `Created At` | `created_at` |
| `Approved By` | resolve → `approved_by` profile id + keep name in notes if needed |
| `Approved At` | `approved_at` |

---

## Status Update (+ Archive) → `property_status_events`

| Legacy | New |
|---|---|
| `Date & Time` | `occurred_at` |
| `Ref No` | `ref_no` + resolve `property_id` |
| `User` | `actor_name` + resolve `actor_id` |
| `Status` | `action` (activity_action; map unknown → keep in comment + closest enum) |
| `Comment` | `comment` |
| `LPW` | `legacy_lpw` |
| `Requested Platforms` | `requested_platforms[]` |
| `Boost Completed` | `boost_completed` |
| `Assigned To` | `assigned_to` |
| Archive rows | same table with `archived_at` set |

---

## Republish Queue → `republish_queue`

| Legacy | New |
|---|---|
| `Ref No` | `ref_no` + `property_id` |
| `User Name` | `user_name` |
| `Status` | `status` (empty = pending) |
| `Action` | `action` |
| `Date` | `queued_at` |

---

## Social Media Queue → `social_media_queue`

| Legacy | New |
|---|---|
| `Ref No` | `ref_no` + `property_id` |
| `Approved Action` | `approved_action` |
| `Approved By` | `approved_by` |
| `Approved Date` | `approved_at` |
| `Ikman Date` / `LPW Date` / `Facebook Date` / `Instagram Date` | `platform_dates` jsonb keys |
| `Completed Date` | `completed_at` |
| `Requested Platforms` | `requested_platforms[]` |
| `Comment` | `comment` |

---

## Messages → `messages`

| Legacy | New |
|---|---|
| `From` | `from_name` (+ `from_profile_id`) |
| `To` | `to_name` |
| `Message` | `body` |
| `Date` | `sent_at` |
| `Resolved` | `resolved` |

---

## Lookups

| Legacy | New |
|---|---|
| `City`.`Name of the City` | `cities.name` |
| `City`.`Added by` | `cities.added_by` |
| `Apartment Complexes`.`Name` | `apartment_complexes.name` |
| `Added By` / `Created At` / `Location` / `Default Amenities` | matching columns; amenities → `text[]` |

---

## Inquiries (Sheets → `inquiries`)

Flexible mapping from Opportunity Register `Inquiries` sheet columns into `inquiry_text`, contact fields, and `raw` jsonb for leftovers.

---

## Intentionally not in v1 schema

- Invoice Tracker year sheets — Sheets adapter first (`app_settings` can hold targets later).
- `Agent Ref No` / `Internal Comments` on properties.
- Storing passwords or WebAuthn blobs in public tables.
