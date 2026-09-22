/** 10 numeric digits for onboarding / admin reset passwords. */
export function generateTempPassword(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => String(b % 10)).join("");
}
