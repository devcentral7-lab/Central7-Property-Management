"use client";

import { useEffect, useState } from "react";
import type { DrivePhoto } from "@/lib/drive/types";
import { listPublicPropertyPhotosAction } from "@/app/app/properties/photo-actions";

export function PublicPropertyPhotos({ refNo }: { refNo: string }) {
  const [photos, setPhotos] = useState<DrivePhoto[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listPublicPropertyPhotosAction(refNo)
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.configured && result.photos.length) {
          setPhotos(result.photos);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refNo]);

  if (!ready || !photos.length) return null;

  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">Photos</h2>
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <li
            key={p.id}
            className="overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${encodeURIComponent(p.id)}?w=800`}
              alt={p.name}
              loading="lazy"
              className="aspect-[4/3] w-full object-cover"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
