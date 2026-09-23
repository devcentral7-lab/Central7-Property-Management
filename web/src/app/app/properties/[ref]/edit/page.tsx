"use client";

import { useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePropertyModal } from "@/app/app/properties/property-modal";

export default function PropertyEditBootstrapPage() {
  const params = useParams<{ ref: string }>();
  const router = useRouter();
  const { openEdit } = usePropertyModal();
  const opened = useRef<string | null>(null);

  useEffect(() => {
    const ref = decodeURIComponent(params.ref || "").toUpperCase();
    if (!ref || opened.current === ref) return;
    opened.current = ref;
    openEdit(ref);
    const t = window.setTimeout(() => {
      router.replace("/app/properties");
    }, 0);
    return () => window.clearTimeout(t);
  }, [params.ref, openEdit, router]);

  return <p className="text-sm text-[var(--muted)]">Opening editor…</p>;
}
