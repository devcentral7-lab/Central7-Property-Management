/**
 * Adds a JPEG copy next to every HEIC/HEIF photo in the Shared drive so the app can show it.
 * Originals are kept. Already-converted photos (same name with .jpg) are skipped, so the
 * script can be re-run safely if it stops part-way.
 *
 * Dry run by default; pass --apply to convert.
 *   npm run drive:convert-heic
 *   npm run drive:convert-heic -- --apply
 */
import { Readable } from "node:stream";
import heicConvert from "heic-convert";
import sharp from "sharp";
import { connect, isApply, listChildren, listDrive, sharedDriveId, withRetry } from "./drive-client";

const MAX_EDGE = 2560;
const CONCURRENCY = 2;

function jpegName(name: string) {
  return `${name.replace(/\.(heic|heif)$/i, "")}.jpg`;
}

async function main() {
  const apply = isApply();
  const { drive, rootId } = connect();
  const driveId = await sharedDriveId(drive, rootId);

  console.log("Finding HEIC/HEIF photos…");
  const heics = await listDrive(
    drive,
    driveId,
    "(mimeType = 'image/heif' or mimeType = 'image/heic')",
    "id, name, size, parents",
  );

  const folderIds = [...new Set(heics.map((f) => f.parents?.[0]).filter(Boolean))] as string[];
  const existing = new Map<string, Set<string>>();
  for (const id of folderIds) {
    const kids = await listChildren(drive, id, "name");
    existing.set(id, new Set(kids.map((k) => (k.name ?? "").toLowerCase())));
  }

  const todo = heics.filter((f) => {
    const folder = f.parents?.[0];
    return folder && !existing.get(folder)?.has(jpegName(f.name ?? "").toLowerCase());
  });
  const bytes = todo.reduce((n, f) => n + Number(f.size ?? 0), 0);

  console.log(`HEIC/HEIF photos: ${heics.length} in ${folderIds.length} folders`);
  console.log(`Already have a JPEG copy: ${heics.length - todo.length}`);
  console.log(`To convert: ${todo.length} (${(bytes / 1024 / 1024).toFixed(0)} MB to download)`);

  if (!apply) {
    console.log("\nDry run only, nothing changed. Re-run with --apply to convert.");
    return;
  }

  let done = 0;
  let failed = 0;
  const queue = [...todo];
  async function worker() {
    for (let f = queue.shift(); f; f = queue.shift()) {
      const file = f;
      try {
        const res = await withRetry(() =>
          drive.files.get(
            { fileId: file.id!, alt: "media", supportsAllDrives: true },
            { responseType: "arraybuffer" },
          ),
        );
        const decoded = await heicConvert({
          buffer: Buffer.from(res.data as ArrayBuffer),
          format: "JPEG",
          quality: 0.9,
        });
        const jpeg = await sharp(Buffer.from(decoded))
          .rotate()
          .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        await withRetry(() =>
          drive.files.create({
            requestBody: { name: jpegName(file.name ?? "photo"), parents: [file.parents![0]] },
            media: { mimeType: "image/jpeg", body: Readable.from(jpeg) },
            supportsAllDrives: true,
            fields: "id",
          }),
        );
        done++;
      } catch (e) {
        failed++;
        console.warn(`  Could not convert ${file.name}: ${e instanceof Error ? e.message : e}`);
      }
      const n = done + failed;
      if (n % 25 === 0 || n === todo.length) console.log(`  ${n}/${todo.length} processed (${failed} failed)`);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\nDone. Converted ${done}, failed ${failed}. Originals were kept.`);
}

main().catch((e) => {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
