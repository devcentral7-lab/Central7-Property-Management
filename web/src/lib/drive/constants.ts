/** Per image upload; the browser downscales larger photos before sending. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** Per non-image attachment (PDF, Word, etc.). */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export const ALLOWED_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export function isImageMime(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  return mimeType.startsWith("image/") && ALLOWED_PHOTO_MIME.has(mimeType);
}

export function maxBytesForMime(mimeType: string): number {
  return isImageMime(mimeType) ? MAX_PHOTO_BYTES : MAX_ATTACHMENT_BYTES;
}
