"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PropertiesSkeleton } from "@/components/skeletons";

function TabAwareSkeleton() {
  const tab = (useSearchParams().get("tab") ?? "").toLowerCase();
  return (
    <PropertiesSkeleton
      tab={tab === "add" || tab === "options" ? "add" : tab === "mine" ? "mine" : "search"}
    />
  );
}

export default function Loading() {
  return (
    <Suspense fallback={<PropertiesSkeleton />}>
      <TabAwareSkeleton />
    </Suspense>
  );
}
