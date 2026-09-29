"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
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

export function PropertyPhotosPanel({ refNo, canEdit }: Props) {
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [configured, setConfigured] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);

  const applyResult = useCallback(
    (result: Awaited<ReturnType<typeof listPropertyPhotosAction>>) => {
      setConfigured(result.configured);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setPhotos(result.photos);
      setCanManage(result.canManage);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void listPropertyPhotosAction(refNo).then((result) => {
      if (cancelled) return;
      applyResult(result);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refNo, applyResult]);

  function onUpload(files: FileList | null) {
    if (!files?.length) return;
    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    startTransition(async () => {
      const result = await uploadPropertyPhotosAction(refNo, fd);
      applyResult(result);
    });
  }

  function onDelete(fileId: string) {
    if (!confirm("Delete this photo from Drive?")) return;
    startTransition(async () => {
      const result = await deletePropertyPhotoAction(refNo, fileId);
      applyResult(result);
    });
  }

  function onRename(fileId: string, current: string) {
    const next = window.prompt("Rename photo", current);
    if (next == null || !next.trim() || next.trim() === current) return;
    startTransition(async () => {
      const result = await renamePropertyPhotoAction(refNo, fileId, next);
      applyResult(result);
    });
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }
    const ids = photos.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) {
      setDragId(null);
      return;
    }
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setDragId(null);
    setPhotos((prev) => {
      const map = new Map(prev.map((p) => [p.id, p]));
      return next.map((id) => map.get(id)!).filter(Boolean);
    });
    startTransition(async () => {
      const result = await reorderPropertyPhotosAction(refNo, next);
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
        <h2 className="font-display text-sm font-semibold">Photos</h2>
        {manage ? (
          <label className="cursor-pointer rounded-full border border-[var(--line)] px-3 py-1.5 text-xs font-semibold hover:bg-[var(--bg-accent)]">
            {pending ? "Working…" : "Upload"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
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

      {loading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Loading photos…</p>
      ) : null}

      {!loading && !configured ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Drive photos are not configured yet.
        </p>
      ) : null}

      {!loading && error ? (
        <p className="mt-3 text-sm text-[var(--danger)]">{error}</p>
      ) : null}

      {!loading && configured && !error && !photos.length ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No photos in Drive for this ref yet.
        </p>
      ) : null}

      {!loading && photos.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li
              key={p.id}
              draggable={manage}
              onDragStart={() => setDragId(p.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(p.id)}
              className="group overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${encodeURIComponent(p.id)}`}
                alt={p.name}
                className="aspect-[4/3] w-full object-cover"
              />
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
          ))}
        </ul>
      ) : null}
    </div>
  );
}
