"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { prepareForUpload } from "@/lib/drive/prepare-upload";
import { isImageMime, maxBytesForMime } from "@/lib/drive/constants";
import type { DrivePhoto } from "@/lib/drive/types";
import {
  deletePropertyPhotoAction,
  listPropertyPhotosAction,
  renamePropertyPhotoAction,
  reorderPropertyPhotosAction,
  uploadPropertyPhotosAction,
} from "@/app/app/properties/photo-actions";

type Props = {
  refNo: string;
  canEdit: boolean;
};

type PhotoResult = Awaited<ReturnType<typeof listPropertyPhotosAction>>;

async function safely(run: () => Promise<PhotoResult>): Promise<PhotoResult> {
  try {
    return await run();
  } catch (e) {
    return {
      ok: false,
      configured: true,
      error: e instanceof Error ? e.message : "Something went wrong. Try again.",
    };
  }
}

function fileExtLabel(name: string, mimeType: string) {
  const fromName = name.includes(".") ? name.split(".").pop() : "";
  if (fromName && fromName.length <= 5) return fromName.toUpperCase();
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word") || mimeType.includes("document")) return "DOC";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "XLS";
  return "FILE";
}

export function PropertyPhotosPanel({ refNo, canEdit }: Props) {
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const applyResult = useCallback((result: PhotoResult) => {
    setConfigured(result.configured);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setPhotos(result.photos);
    setCanManage(result.canManage);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const result = await safely(() => listPropertyPhotosAction(refNo));
      if (cancelled) return;
      applyResult(result);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refNo, applyResult]);

  function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const picked = Array.from(files);
    startTransition(async () => {
      const failures: string[] = [];
      let last: PhotoResult | null = null;
      for (let i = 0; i < picked.length; i++) {
        setProgress(`Uploading ${i + 1} of ${picked.length}…`);
        const file = await prepareForUpload(picked[i]);
        const mime = file.type || "application/octet-stream";
        const limit = maxBytesForMime(mime);
        if (file.size > limit) {
          failures.push(
            `${picked[i].name} is too large (max ${limit / (1024 * 1024)} MB)`,
          );
          continue;
        }
        const fd = new FormData();
        fd.append("files", file);
        const result = await safely(() => uploadPropertyPhotosAction(refNo, fd));
        if (result.ok) last = result;
        else failures.push(`${picked[i].name}: ${result.error}`);
      }
      setProgress(null);
      if (last) applyResult(last);
      if (failures.length) {
        setError(
          `${failures.length} of ${picked.length} file(s) didn't upload. ${failures.join(" · ")}`,
        );
      }
    });
  }

  function onDelete(fileId: string) {
    if (!confirm("Delete this file from Drive?")) return;
    startTransition(async () => {
      const result = await safely(() => deletePropertyPhotoAction(refNo, fileId));
      applyResult(result);
    });
  }

  function onRename(fileId: string, current: string) {
    const next = window.prompt("Rename file", current);
    if (next == null || !next.trim() || next.trim() === current) return;
    startTransition(async () => {
      const result = await safely(() => renamePropertyPhotoAction(refNo, fileId, next));
      applyResult(result);
    });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    // Only reorder images — that order drives the PDF photo section.
    const imageIds = photos.filter((p) => isImageMime(p.mimeType)).map((p) => p.id);
    const from = imageIds.indexOf(dragId);
    const to = imageIds.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    const next = [...imageIds];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setDragId(null);
    setPhotos((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      const images = next.map((id) => byId.get(id)!).filter(Boolean);
      const other = prev.filter((p) => !isImageMime(p.mimeType));
      return [...images, ...other];
    });
    startTransition(async () => {
      const result = await safely(() => reorderPropertyPhotosAction(refNo, next));
      applyResult(result);
    });
  }

  const manage = canEdit && canManage && configured;

  if (!loading && !configured && !canEdit) {
    return null;
  }

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-semibold">Attachments</h2>
          <p className="text-xs text-[var(--muted)]">
            Any file type. Only images are included in PDF reports.
          </p>
        </div>
        {manage ? (
          <label className="cursor-pointer rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)]">
            {progress ?? (pending ? "Working…" : "Upload")}
            <input
              type="file"
              multiple
              className="hidden"
              disabled={pending}
              onChange={(e) => {
                onUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}
      </div>

      {loading ? <p className="mt-3 text-sm text-[var(--muted)]">Loading attachments…</p> : null}

      {!loading && !configured ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Drive attachments are not configured yet.</p>
      ) : null}

      {!loading && error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}

      {!loading && configured && !error && !photos.length ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No files in Drive for this ref yet.</p>
      ) : null}

      {!loading && photos.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => {
            const image = isImageMime(p.mimeType);
            return (
              <li
                key={p.id}
                draggable={manage && image}
                onDragStart={() => {
                  if (image) setDragId(p.id);
                }}
                onDragOver={(e) => {
                  if (image) e.preventDefault();
                }}
                onDrop={() => {
                  if (image) onDrop(p.id);
                }}
                className="group overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]"
              >
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/photos/${encodeURIComponent(p.id)}?w=800`}
                    alt={p.name}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover"
                  />
                ) : (
                  <a
                    href={`/api/photos/${encodeURIComponent(p.id)}`}
                    className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-1 bg-[var(--bg-accent)]/50 text-[var(--brand)] hover:bg-[var(--bg-accent)]"
                  >
                    <span className="text-lg font-bold tracking-wide">
                      {fileExtLabel(p.name, p.mimeType)}
                    </span>
                    <span className="text-[10px] font-semibold uppercase text-[var(--muted)]">
                      Download
                    </span>
                  </a>
                )}
                <div className="space-y-1 p-2">
                  <p className="truncate text-xs text-[var(--muted)]" title={p.name}>
                    {p.name}
                  </p>
                  {manage ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onRename(p.id, p.name)}
                        className="text-xs font-semibold text-[var(--brand-deep)] hover:underline disabled:opacity-60"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onDelete(p.id)}
                        className="text-xs font-semibold text-[var(--danger)] hover:underline disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
