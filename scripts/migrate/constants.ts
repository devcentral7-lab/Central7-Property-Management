/** Shared enums and legacy column keys — aligned with Code.gs */

export const OPPORTUNITY_TYPES = ['Sell', 'Rent Out'] as const;
export const PROPERTY_TYPES = [
  'House',
  'Land',
  'Apartment',
  'Commercial Property',
  'Estate',
] as const;
export const STATUS_LIST = [
  'Active',
  'Hold',
  'Lost',
  'Drop',
  'Closed',
  'Obsolete',
] as const;
export const FURNISHED_LIST = [
  'Not Furnished',
  'Partly Furnished',
  'Fully Furnished',
] as const;
export const CONTACT_TYPES = ['Direct', 'Partner'] as const;
export const SOCIAL_MEDIA_PLATFORMS = [
  'Ikman',
  'LPW',
  'Facebook',
  'Instagram',
] as const;

export const AMENITIES_LIST = [
  'Swimming Pool',
  'Rooftop',
  'Rooftop Garden',
  'Rumpus Room (Room for games)',
  'Gym',
  'Garden Space',
  'Maids Room',
  'Maids Toilet',
  'Bar Area',
  'Servant Quarters',
  'Solar Panels',
  'Generator',
  'CCTV',
  'Lift/Elevator',
  'Balcony',
  'Garage',
  'Study Room',
  'Store Room',
  'Air Conditioning',
  'Sea View',
  'Water Tank',
] as const;

export const LEGACY_PROPERTY_TABLE = 'C7_Pulse_DB_Dev';
export const LEGACY_TABLES = [
  'C7_Pulse_DB_Dev',
  'User',
  'Agents',
  'Apartment Complexes',
  'City',
  'Status Update',
  'Status Update Archive',
  'Republish Queue',
  'Social Media Queue',
  'Messages',
] as const;

export const PROPERTY_COLUMN_NAMES = [
  'Ref No',
  'Timestamp',
  'User',
  'Type of Contact (Direct/ Partner)',
  'Name of Contact',
  'Contact No 1',
  'Contact No 2',
  'Email',
  'Opportunity Type',
  'Property Type',
  'Purpose',
  'Property Sub-type',
  'Address',
  'City',
  'land Size (perch)',
  'Bed Rooms',
  'Bath Rooms',
  'Floor Area (sqft)',
  'No of Floors',
  'Parking Space (No of vehicles)',
  'Age of the House',
  'Other Amenities',
  'Other information',
  'land Size (perch)_1',
  'Suitable for',
  'Other Amenities_1',
  'Other information_1',
  'Apartment Complex',
  'Floor',
  'Number of Rooms',
  'Number of Bath Rooms',
  'Floor Area (sqft)_1',
  'Dedicated Parking Slots',
  'View',
  'Other Amenities_2',
  'Comments',
  'Purpose_1',
  'Size of Land (Perch)',
  'Built up Area',
  'Comments_1',
  'Currency',
  'Price per Perch',
  'Price per sqft',
  'Price Total',
  'Budget',
  'Comments_2',
  'Furnished',
  'Status',
] as const;

export type PropertyType = (typeof PROPERTY_TYPES)[number];
