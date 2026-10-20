"use client";

import { useEffect, useRef, useState } from "react";
import {
  isImageMime,
  maxBytesForMime,
  MAX_ATTACHMENT_BYTES,
  MAX_PHOTO_BYTES,
} from "@/lib/drive/constants";
import { prepareForUpload } from "@/lib/drive/prepare-upload";

type Props = {
  files: File[];
  configured: boolean;
  disabled: boolean;
  className?: string;
  onChange: (files: File[]) => void;
  onPreparing: (preparing: boolean) => void;
};

export function PropertyImageAttachments({
  files,
  configured,
  disabled,
  className = "",
  onChange,
  onPreparing,
}: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attach(picked: File[]) {
    setPreparing(true);
    onPreparing(true);
    setError(null);
    const accepted: File[] = [];
    const errors: string[] = [];
    try {
      for (const file of picked) {
        const prepared = isImageMime(file.type) ? await prepareForUpload(file) : file;
        const mime = prepared.type || file.type || "application/octet-stream";
        const limit = maxBytesForMime(mime);
        if (prepared.size > limit) {
          const mb = limit / (1024 * 1024);
          errors.push(
            isImageMime(mime)
              ? `${file.name}: image must be under ${mb} MB after resizing.`
              : `${file.name}: file must be under ${mb} MB.`,
          );
          continue;
        }
        accepted.push(prepared);
      }
      onChange([...files, ...accepted]);
      if (errors.length) setError(errors.join(" "));
    } finally {
      setPreparing(false);
      onPreparing(false);
    }
  }

  return (
    <section
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-6 ${className}`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Attachments</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Files upload when you save. Images go into the PDF report; other files stay in Drive.
          </p>
        </div>
        <button
          type="button"
          disabled={!configured || disabled || preparing}
          onClick={() => picker.current?.click()}
          className="rounded-xl border border-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {preparing ? "Preparing…" : "Attach files"}
        </button>
        <input
          ref={picker}
          type="file"
          multiple
          className="hidden"
          disabled={disabled || preparing || !configured}
          onChange={(event) => {
            const picked = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
            if (picked.length) void attach(picked);
          }}
        />
      </div>
      {!configured ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          Attachments are not configured. Please contact an administrator.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : null}
      <div
        className="mt-4 h-28 shrink-0 overflow-y-auto overscroll-contain"
        aria-label="Attachments"
        tabIndex={files.length ? 0 : undefined}
      >
        {files.length ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(80px,1fr))] gap-3 pr-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="relative min-w-0"
                title={`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`}
              >
                <AttachedFilePreview file={file} />
                <span className="mt-1 block truncate text-[11px] text-[var(--muted)]">{file.name}</span>
                <button
                  type="button"
                  disabled={disabled || preparing}
                  aria-label={`Remove ${file.name}`}
                  onClick={() => onChange(files.filter((_, i) => i !== index))}
                  className="absolute right-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--line)] bg-white text-sm font-semibold text-[var(--danger)] shadow-sm hover:bg-red-50 disabled:opacity-50"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">No files attached yet.</p>
        )}
      </div>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Images up to {MAX_PHOTO_BYTES / (1024 * 1024)} MB · other files up to{" "}
        {MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB
      </p>
    </section>
  );
}

function AttachedFilePreview({ file }: { file: File }) {
  const image = useRef<HTMLImageElement>(null);
  const isImage = isImageMime(file.type);

  useEffect(() => {
    if (!isImage) return;
    const url = URL.createObjectURL(file);
    if (image.current) image.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, isImage]);

  if (!isImage) {
    const ext = file.name.includes(".") ? file.name.split(".").pop()?.toUpperCase() : "FILE";
    return (
      <div className="flex h-[72px] w-[72px] flex-col items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg)] px-1 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand)]">
          {ext?.slice(0, 5) || "FILE"}
        </span>
      </div>
    );
  }

  return (
    // Local File previews use temporary object URLs, with no image optimization request.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={image}
      alt={file.name}
      width={72}
      height={72}
      className="h-[72px] w-[72px] rounded-lg border border-[var(--line)] bg-[var(--bg)] object-cover"
    />
  );
}
