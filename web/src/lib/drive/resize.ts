import sharp from "sharp";

/** Baseline JPEG no larger than `maxEdge` on either side, EXIF-rotated. */
export async function resizeToJpeg(
  buffer: Buffer,
  maxEdge: number,
  quality = 78,
): Promise<Buffer> {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, progressive: false })
    .toBuffer();
}
