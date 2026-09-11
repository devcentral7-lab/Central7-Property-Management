import type { ListingStatus, OpportunityType, PropertyType, StaffRole } from "./constants";

export type Profile = {
  id: string;
  display_name: string;
  mobile_number: string | null;
  role: StaffRole;
  photo_drive_id: string | null;
  active: boolean;
};

export type PropertyCard = {
  id: string;
  ref_no: string;
  ref_seq: number;
  created_at: string;
  created_by_name: string | null;
  opportunity_type: OpportunityType;
  property_type: PropertyType;
  city: string | null;
  status: ListingStatus;
  currency: "LKR" | "USD";
  price_total: number | null;
  budget: number | null;
  land_size_perch: number | null;
  floor_area_sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  do_not_publish: boolean;
  contact_name?: string;
  contact_phone_1?: string;
};

export type Property = PropertyCard & {
  contact_type: string | null;
  contact_phone_2: string | null;
  contact_email: string | null;
  purpose: string | null;
  address: string | null;
  number_of_floors: number | null;
  parking_spaces: number | null;
  age_years: number | null;
  apartment_floor: string | null;
  view: string | null;
  price_per_perch: number | null;
  price_per_sqft: number | null;
  furnished: string | null;
  amenities: string[];
  comments: string | null;
  type_attributes: Record<string, unknown>;
};
