/** Domain enums — aligned with Code.gs + optimized schema */

export const OPPORTUNITY_TYPES = ["Sell", "Rent Out"] as const;
export const PROPERTY_TYPES = [
  "House",
  "Land",
  "Apartment",
  "Commercial Property",
  "Estate",
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
  "Publish",
  "Republish",
  "Drop",
  "Lost",
  "Hold",
  "New Ad Published",
  "Closed",
  "Data Change",
  "Obsolete",
] as const;
export const AMENITIES_LIST = [
  "Swimming Pool",
  "Rooftop",
  "Rooftop Garden",
  "Rumpus Room (Room for games)",
  "Gym",
  "Garden Space",
  "Maids Room",
  "Maids Toilet",
  "Bar Area",
  "Servant Quarters",
  "Solar Panels",
  "Generator",
  "CCTV",
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
export type StaffRole = "Admin" | "User";
