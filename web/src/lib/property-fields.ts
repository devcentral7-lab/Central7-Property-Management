/** Type-specific attribute keys that apply to each property type. */
export function typeSpecificKeys(propertyType: string): Set<string> {
  if (propertyType === "Land") {
    return new Set(["land_size_perch", "suitable_for"]);
  }
  if (propertyType === "Apartment") {
    return new Set([
      "apartment_complex",
      "apartment_floor",
      "bedrooms",
      "bathrooms",
      "floor_area_sqft",
      "parking_spaces",
      "view",
    ]);
  }
  if (propertyType === "Commercial Property") {
    return new Set(["suitable_for", "land_size_perch", "built_up_area"]);
  }
  return new Set([
    "land_size_perch",
    "bedrooms",
    "bathrooms",
    "floor_area_sqft",
    "number_of_floors",
    "parking_spaces",
    "age_years",
  ]);
}
