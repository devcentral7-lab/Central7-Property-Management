/** Multi-select filters travel as one comma-separated value, e.g. `?city=Kandy,Galle`. */
export function splitListParam(value: string): string[] {
  return [...new Set(value.split(",").map((c) => c.trim()).filter(Boolean))];
}
