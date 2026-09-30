/** Per upload request; the browser downscales larger photos before sending. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export const ALLOWED_PHOTO_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);
