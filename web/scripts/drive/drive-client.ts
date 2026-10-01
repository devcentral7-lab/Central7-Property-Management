import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { google, type drive_v3 } from "googleapis";

export const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Reads only the two Drive settings from web/.env.local (works from repo root or web/). */
function loadDriveEnv() {
  const candidates = [path.resolve("web/.env.local"), path.resolve(".env.local")];
  const file = candidates.find((p) => existsSync(p));
  if (!file) throw new Error("web/.env.local not found");
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^(GOOGLE_SERVICE_ACCOUNT_JSON|PHOTOS_ROOT_FOLDER_ID)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.PHOTOS_ROOT_FOLDER_ID) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON and PHOTOS_ROOT_FOLDER_ID must be set in web/.env.local");
  }
  const raw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const credentials = JSON.parse(raw.startsWith("{") ? raw : readFileSync(raw, "utf8"));
  return { credentials, rootId: env.PHOTOS_ROOT_FOLDER_ID };
}

export function connect(): { drive: drive_v3.Drive; rootId: string } {
  const { credentials, rootId } = loadDriveEnv();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return { drive: google.drive({ version: "v3", auth }), rootId };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Retries Drive rate-limit and transient server errors with exponential backoff. */
export async function withRetry<T>(fn: () => Promise<T>, label = "drive call"): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const err = e as { code?: number; errors?: { reason?: string }[] };
      const reason = err.errors?.[0]?.reason ?? "";
      const retryable =
        err.code === 429 ||
        (err.code ?? 0) >= 500 ||
        (err.code === 403 && /rateLimit/i.test(reason));
      if (!retryable || attempt >= 7) throw e;
      const wait = Math.min(60_000, 2 ** attempt * 1000) + Math.random() * 500;
      console.warn(`  ${label}: ${reason || err.code}, retrying in ${Math.round(wait / 1000)}s`);
      await sleep(wait);
    }
  }
}

/** All items in the Shared drive matching `q`, following pagination. */
export async function listDrive(
  drive: drive_v3.Drive,
  driveId: string,
  q: string,
  fields: string,
): Promise<drive_v3.Schema$File[]> {
  const out: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const res = await withRetry(() =>
      drive.files.list({
        corpora: "drive",
        driveId,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        q: `${q} and trashed = false`,
        fields: `nextPageToken, files(${fields})`,
        pageSize: 1000,
        pageToken,
      }),
    );
    out.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

/** Direct children of a folder. */
export async function listChildren(
  drive: drive_v3.Drive,
  folderId: string,
  fields = "id, name, mimeType, size, md5Checksum",
): Promise<drive_v3.Schema$File[]> {
  const out: drive_v3.Schema$File[] = [];
  let pageToken: string | undefined;
  do {
    const res = await withRetry(() =>
      drive.files.list({
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        q: `'${folderId}' in parents and trashed = false`,
        fields: `nextPageToken, files(${fields})`,
        pageSize: 1000,
        pageToken,
      }),
    );
    out.push(...(res.data.files ?? []));
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
}

export async function sharedDriveId(drive: drive_v3.Drive, rootId: string): Promise<string> {
  const { data } = await withRetry(() =>
    drive.files.get({ fileId: rootId, fields: "driveId", supportsAllDrives: true }),
  );
  if (!data.driveId) throw new Error("The photos root folder is not inside a Shared drive");
  return data.driveId;
}

export function isApply(): boolean {
  return process.argv.includes("--apply");
}
