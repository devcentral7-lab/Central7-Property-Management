/** Domain enums — aligned with Code.gs + optimized schema */

export const OPPORTUNITY_TYPES = ["Sell", "Rent Out"] as const;
export const PROPERTY_TYPES = [
  "Apartment",
  "House",
  "Land",
  "Commercial Property",
] as const;
/** Property types where the Furnished field applies. */
export const FURNISHABLE_TYPES: readonly string[] = ["Apartment", "House", "Commercial Property"];
export const COMMERCIAL_SUBTYPES = [
  "Estate",
  "Warehouse",
  "Office Space",
  "Factory",
  "Commercial Building",
  "Apartment Complex",
  "Hotel",
  "Restaurant or Cafe",
] as const;
export const STATUS_LIST = [
  "Active",
  "Hold",
  "Lost",
  "Drop",
  "Closed",
  "Obsolete",
] as const;
export const FURNISHED_LIST = [
  "Not Furnished",
  "Partly Furnished",
  "Fully Furnished",
] as const;
export const CONTACT_TYPES = ["Direct", "Partner"] as const;
export const SOCIAL_MEDIA_PLATFORMS = [
  "Ikman",
  "LPW",
  "Facebook",
  "Instagram",
] as const;
export const STATUS_CHANGE_OPTIONS = [
  "Republish",
  "Drop",
  "Lost",
  "Closed",
  "Data Change",
] as const;
export const AMENITIES_LIST = [
  "Swimming Pool",
  "Swimming Pool and Kids' Pool",
  "Pool and Spa Complex",
  "Rooftop",
  "Rooftop Garden",
  "Mini Theatre",
  "Indoor Games Room",
  "Rumpus Room (Room for games)",
  "Gym",
  "Yoga Centre",
  "Garden Space",
  "Children's Play Area",
  "Indoor Play Zone",
  "Kids' Library",
  "Banquet Hall",
  "Business Centre",
  "Conference and Meeting Rooms",
  "24-Hour Security",
  "Maids Room",
  "Maids Toilet",
  "Bar Area",
  "Servant Quarters",
  "Solar Panels",
  "Generator",
  "CCTV",
  "Mini Supermarket",
  "Laundry Services",
  "Salon",
  "Car Wash Facility",
  "Electric Vehicle Charging Points",
  "Lift/Elevator",
  "Balcony",
  "Garage",
  "Study Room",
  "Store Room",
  "Air Conditioning",
  "Sea View",
  "Water Tank",
] as const;

export const PAGE_SIZE = 25;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type PropertyType = (typeof PROPERTY_TYPES)[number];
export type ListingStatus = (typeof STATUS_LIST)[number];
export const STAFF_ROLES = ["Admin", "User", "Social Media Manager"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function parseStaffRole(raw: string): StaffRole {
  if (raw === "Admin" || raw === "Social Media Manager") return raw;
  return "User";
}

export function isSocialMediaManager(role: StaffRole): boolean {
  return role === "Social Media Manager";
}

/** Paths a Social Media Manager may open (queue, dashboard, profile, listing view). */
export function socialManagerPathAllowed(pathname: string): boolean {
  if (pathname === "/app" || pathname === "/app/") return true;
  if (pathname.startsWith("/app/social-queue")) return true;
  if (pathname.startsWith("/app/account")) return true;
  // Property detail / modal view from the queue (not list, add, or edit).
  if (/^\/app\/properties\/[^/]+\/?$/.test(pathname)) return true;
  return false;
}
