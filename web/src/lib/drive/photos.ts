import { readFileSync } from "fs";
import { Readable } from "stream";
import { google, type drive_v3 } from "googleapis";
import { isImageMime, maxBytesForMime } from "@/lib/drive/constants";
import type { DrivePhoto } from "@/lib/drive/types";

export type { DrivePhoto } from "@/lib/drive/types";
export {
  ALLOWED_PHOTO_MIME,
  isImageMime,
  maxBytesForMime,
  MAX_ATTACHMENT_BYTES,
  MAX_PHOTO_BYTES,
} from "@/lib/drive/constants";

export class DrivePhotosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DrivePhotosError";
  }
}

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() &&
      process.env.PHOTOS_ROOT_FOLDER_ID?.trim(),
  );
}

function photosRootId(): string {
  const id = process.env.PHOTOS_ROOT_FOLDER_ID?.trim();
  if (!id) throw new DrivePhotosError("PHOTOS_ROOT_FOLDER_ID is not set");
  return id;
}

function loadServiceAccount(): Record<string, unknown> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new DrivePhotosError("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  try {
    if (raw.startsWith("{")) return JSON.parse(raw) as Record<string, unknown>;
    return JSON.parse(readFileSync(raw, "utf8")) as Record<string, unknown>;
  } catch {
    throw new DrivePhotosError("Invalid GOOGLE_SERVICE_ACCOUNT_JSON");
  }
}

let cachedDrive: drive_v3.Drive | null = null;

export function getDriveClient(): drive_v3.Drive {
  if (cachedDrive) return cachedDrive;
  const credentials = loadServiceAccount();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  cachedDrive = google.drive({ version: "v3", auth });
  return cachedDrive;
}

function escapeDriveQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export async function findPropertyFolderId(
  refNo: string,
): Promise<string | null> {
  const drive = getDriveClient();
  const root = photosRootId();
  const name = refNo.toUpperCase();
  const res = await drive.files.list({
    q: [
      `'${escapeDriveQuery(root)}' in parents`,
      `name = '${escapeDriveQuery(name)}'`,
      "mimeType = 'application/vnd.google-apps.folder'",
      "trashed = false",
    ].join(" and "),
    fields: "files(id, name)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  return res.data.files?.[0]?.id ?? null;
}

export async function getOrCreatePropertyFolder(refNo: string): Promise<string> {
  const existing = await findPropertyFolderId(refNo);
  if (existing) return existing;

  const drive = getDriveClient();
  const root = photosRootId();
  const created = await drive.files.create({
    requestBody: {
      name: refNo.toUpperCase(),
      mimeType: "application/vnd.google-apps.folder",
      parents: [root],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = created.data.id;
  if (!id) throw new DrivePhotosError("Failed to create property photo folder");
  return id;
}

async function listPropertyFiles(
  refNo: string,
  imagesOnly: boolean,
): Promise<DrivePhoto[]> {
  if (!isDriveConfigured()) return [];
  const folderId = await findPropertyFolderId(refNo);
  if (!folderId) return [];

  const drive = getDriveClient();
  const files: DrivePhoto[] = [];
  let pageToken: string | undefined;
  const mimeFilter = imagesOnly
    ? "(mimeType contains 'image/')"
    : "mimeType != 'application/vnd.google-apps.folder'";

  do {
    const res = await drive.files.list({
      q: [
        `'${escapeDriveQuery(folderId)}' in parents`,
        "trashed = false",
        mimeFilter,
      ].join(" and "),
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 100,
      pageToken,
      orderBy: "name_natural",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    for (const f of res.data.files ?? []) {
      if (!f.id || !f.mimeType) continue;
      if (imagesOnly && !isImageMime(f.mimeType)) continue;
      files.push({
        id: f.id,
        name: f.name || (imagesOnly ? "photo" : "file"),
        mimeType: f.mimeType,
      });
    }
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);

  return files;
}

/** Images only — used by PDF reports and the public gallery. */
export async function listPropertyPhotos(refNo: string): Promise<DrivePhoto[]> {
  return listPropertyFiles(refNo, true);
}

/** Every file in the property Drive folder (images, PDFs, docs, …). */
export async function listPropertyAttachments(refNo: string): Promise<DrivePhoto[]> {
  return listPropertyFiles(refNo, false);
}

export async function uploadPropertyPhotos(
  refNo: string,
  files: { name: string; mimeType: string; buffer: Buffer }[],
): Promise<DrivePhoto[]> {
  if (!files.length) return [];
  const folderId = await getOrCreatePropertyFolder(refNo);
  const drive = getDriveClient();
  const uploaded: DrivePhoto[] = [];

  for (const file of files) {
    const mime = file.mimeType || "application/octet-stream";
    const limit = maxBytesForMime(mime);
    if (file.buffer.byteLength > limit) {
      throw new DrivePhotosError(
        `File too large (max ${limit / (1024 * 1024)} MB): ${file.name}`,
      );
    }
    const created = await drive.files.create({
      requestBody: {
        name: file.name || (isImageMime(mime) ? "photo.jpg" : "attachment"),
        parents: [folderId],
      },
      media: {
        mimeType: mime,
        body: BufferReadable(file.buffer),
      },
      fields: "id, name, mimeType",
      supportsAllDrives: true,
    });
    if (!created.data.id) {
      throw new DrivePhotosError(`Upload did not return a file ID: ${file.name}`);
    }
    uploaded.push({
      id: created.data.id,
      name: created.data.name || file.name,
      mimeType: created.data.mimeType || mime,
    });
  }

  return uploaded;
}

/** Minimal Readable for googleapis upload. */
function BufferReadable(buffer: Buffer) {
  return Readable.from(buffer);
}

export async function assertFileInPropertyFolder(
  fileId: string,
  refNo: string,
  imagesOnly = false,
): Promise<{ id: string; name: string; mimeType: string }> {
  const drive = getDriveClient();
  const folderId = await findPropertyFolderId(refNo);
  if (!folderId) throw new DrivePhotosError("Property photo folder not found");

  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, parents, trashed",
    supportsAllDrives: true,
  });
  if (meta.data.trashed) throw new DrivePhotosError("File not found");
  const parents = meta.data.parents || [];
  if (!parents.includes(folderId)) {
    throw new DrivePhotosError("File is not in this property folder");
  }
  if (!meta.data.mimeType) throw new DrivePhotosError("File not found");
  if (imagesOnly && !isImageMime(meta.data.mimeType)) {
    throw new DrivePhotosError("Not an image file");
  }
  return {
    id: meta.data.id!,
    name: meta.data.name || (imagesOnly ? "photo" : "file"),
    mimeType: meta.data.mimeType,
  };
}

/**
 * Resolve which property ref owns a file (parent folder name under photos root).
 * Pass `imagesOnly: true` for the public photo proxy / PDF path.
 */
export async function resolvePhotoRef(
  fileId: string,
  imagesOnly = true,
): Promise<string | null> {
  if (!isDriveConfigured()) return null;
  const drive = getDriveClient();
  const root = photosRootId();
  const meta = await drive.files.get({
    fileId,
    fields: "id, mimeType, parents, trashed",
    supportsAllDrives: true,
  });
  if (meta.data.trashed) return null;
  if (!meta.data.mimeType) return null;
  if (imagesOnly && !isImageMime(meta.data.mimeType)) return null;
  const parentId = meta.data.parents?.[0];
  if (!parentId) return null;

  const parent = await drive.files.get({
    fileId: parentId,
    fields: "id, name, parents",
    supportsAllDrives: true,
  });
  const parentParents = parent.data.parents || [];
  if (!parentParents.includes(root)) return null;
  const name = (parent.data.name || "").toUpperCase();
  return name || null;
}

export async function downloadPhoto(
  fileId: string,
  imagesOnly = true,
): Promise<{ buffer: Buffer; mimeType: string; name: string }> {
  const drive = getDriveClient();
  const meta = await drive.files.get({
    fileId,
    fields: "id, name, mimeType, trashed",
    supportsAllDrives: true,
  });
  if (meta.data.trashed) throw new DrivePhotosError("File not found");
  if (!meta.data.mimeType) throw new DrivePhotosError("File not found");
  if (imagesOnly && !isImageMime(meta.data.mimeType)) {
    throw new DrivePhotosError("Not an image file");
  }
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" },
  );
  const data = res.data as ArrayBuffer;
  return {
    buffer: Buffer.from(data),
    mimeType: meta.data.mimeType,
    name: meta.data.name || (imagesOnly ? "photo" : "file"),
  };
}

export async function deletePropertyPhoto(
  refNo: string,
  fileId: string,
): Promise<void> {
  await assertFileInPropertyFolder(fileId, refNo);
  const drive = getDriveClient();
  await drive.files.update({
    fileId,
    requestBody: { trashed: true },
    supportsAllDrives: true,
  });
}

export async function renamePropertyPhoto(
  refNo: string,
  fileId: string,
  name: string,
): Promise<DrivePhoto> {
  const trimmed = name.trim();
  if (!trimmed) throw new DrivePhotosError("Name is required");
  await assertFileInPropertyFolder(fileId, refNo);
  const drive = getDriveClient();
  const updated = await drive.files.update({
    fileId,
    requestBody: { name: trimmed },
    fields: "id, name, mimeType",
    supportsAllDrives: true,
  });
  return {
    id: updated.data.id!,
    name: updated.data.name || trimmed,
    mimeType: updated.data.mimeType || "image/jpeg",
  };
}
