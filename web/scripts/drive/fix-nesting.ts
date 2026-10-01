/**
 * Moves listing folders (C7-xxxx) that were dropped inside other folders back under the
 * photos root. Where the root already has a folder with that name, the contents are merged
 * into it (identical files are skipped) and the emptied copy is trashed.
 *
 * Dry run by default; pass --apply to make changes.
 *   npm run drive:fix-nesting
 *   npm run drive:fix-nesting -- --apply
 */
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { drive_v3 } from "googleapis";
import {
  FOLDER_MIME,
  connect,
  isApply,
  listChildren,
  listDrive,
  sharedDriveId,
  withRetry,
} from "./drive-client";

const REF_RE = /^C7-\d+$/i;

type Step =
  | { kind: "move-folder"; ref: string; from: string; folderId: string; parentId: string }
  | {
      kind: "merge";
      ref: string;
      from: string;
      folderId: string;
      targetId: string;
      move: { id: string; name: string }[];
      identical: string[];
    };

async function main() {
  const apply = isApply();
  const { drive, rootId } = connect();
  const driveId = await sharedDriveId(drive, rootId);

  console.log("Scanning folders in the Shared drive…");
  const folders = await listDrive(drive, driveId, `mimeType = '${FOLDER_MIME}'`, "id, name, parents");
  const byId = new Map(folders.map((f) => [f.id!, f]));
  const topByName = new Map(
    folders.filter((f) => f.parents?.includes(rootId)).map((f) => [f.name!.toUpperCase(), f]),
  );

  const depth = (f: drive_v3.Schema$File): number => {
    let d = 0;
    let cur: drive_v3.Schema$File | undefined = f;
    while (cur && !cur.parents?.includes(rootId) && d < 50) {
      cur = byId.get(cur.parents?.[0] ?? "");
      d++;
    }
    return d;
  };

  const misplaced = folders
    .filter((f) => REF_RE.test(f.name ?? "") && f.id !== rootId && !f.parents?.includes(rootId))
    .sort((a, b) => depth(b) - depth(a));

  console.log(`Found ${misplaced.length} misplaced listing folders, comparing contents…`);
  const planned = new Map<string, Step>();
  let checked = 0;
  const queue = [...misplaced];
  async function plan(f: drive_v3.Schema$File) {
    const ref = f.name!.toUpperCase();
    const parentId = f.parents?.[0] ?? "";
    const from = byId.get(parentId)?.name ?? "(unknown)";
    const target = topByName.get(ref);
    if (!target) {
      planned.set(f.id!, { kind: "move-folder", ref, from, folderId: f.id!, parentId });
      return;
    }
    const [mine, theirs] = await Promise.all([listChildren(drive, f.id!), listChildren(drive, target.id!)]);
    const theirKeys = new Set(
      theirs.map((x) => `${x.name}|${x.md5Checksum ?? ""}|${x.size ?? ""}`),
    );
    const move: { id: string; name: string }[] = [];
    const identical: string[] = [];
    for (const x of mine) {
      // Nested listing folders are misplaced too and are handled first (deepest first).
      if (x.mimeType === FOLDER_MIME && REF_RE.test(x.name ?? "")) continue;
      const key = `${x.name}|${x.md5Checksum ?? ""}|${x.size ?? ""}`;
      if (x.md5Checksum && theirKeys.has(key)) identical.push(x.name!);
      else move.push({ id: x.id!, name: x.name! });
    }
    planned.set(f.id!, { kind: "merge", ref, from, folderId: f.id!, targetId: target.id!, move, identical });
  }
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        await plan(f);
        checked++;
        if (checked % 25 === 0) console.log(`  checked ${checked}/${misplaced.length}`);
      }
    }),
  );
  // Keep deepest-first order for applying.
  const steps = misplaced.map((f) => planned.get(f.id!)!);

  const moves = steps.filter((s) => s.kind === "move-folder");
  const merges = steps.filter((s): s is Extract<Step, { kind: "merge" }> => s.kind === "merge");
  const filesToMove = merges.reduce((n, s) => n + s.move.length, 0);
  const identicalFiles = merges.reduce((n, s) => n + s.identical.length, 0);
  const fromCounts: Record<string, number> = {};
  for (const s of steps) fromCounts[s.from] = (fromCounts[s.from] ?? 0) + 1;

  console.log(`\nMisplaced listing folders: ${steps.length}`, fromCounts);
  console.log(`  Move whole folder to the top level: ${moves.length}`);
  console.log(`  Merge into the existing top-level folder: ${merges.length}`);
  console.log(`    files to move: ${filesToMove} | identical files skipped: ${identicalFiles}`);
  console.log(`    emptied copies to trash: ${merges.length}`);
  for (const s of merges.slice(0, 5)) {
    console.log(`    e.g. ${s.ref} (inside ${s.from}): move ${s.move.length}, identical ${s.identical.length}`);
  }

  const reportDir = existsSync(path.resolve("data/clean")) ? path.resolve("data/clean") : process.cwd();
  const report = path.join(reportDir, `drive-nesting-${apply ? "applied" : "plan"}.json`);
  writeFileSync(report, JSON.stringify(steps, null, 2));
  console.log(`\nFull plan written to ${path.relative(process.cwd(), report)}`);

  if (!apply) {
    console.log("\nDry run only, nothing changed. Re-run with --apply to make these changes.");
    return;
  }

  let done = 0;
  for (const s of steps) {
    if (s.kind === "move-folder") {
      await withRetry(() =>
        drive.files.update({
          fileId: s.folderId,
          addParents: rootId,
          removeParents: s.parentId,
          supportsAllDrives: true,
          fields: "id",
        }),
      );
    } else {
      for (const file of s.move) {
        await withRetry(() =>
          drive.files.update({
            fileId: file.id,
            addParents: s.targetId,
            removeParents: s.folderId,
            supportsAllDrives: true,
            fields: "id",
          }),
        );
      }
      await withRetry(() =>
        drive.files.update({
          fileId: s.folderId,
          requestBody: { trashed: true },
          supportsAllDrives: true,
          fields: "id",
        }),
      );
    }
    done++;
    if (done % 20 === 0 || done === steps.length) console.log(`  ${done}/${steps.length} folders fixed`);
  }
  console.log("\nDone. Trashed copies stay in the Shared drive's trash for 30 days.");
}

main().catch((e) => {
  console.error("Failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
