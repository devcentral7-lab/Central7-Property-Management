"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/error-panel";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <ErrorPanel
        title="Something went wrong"
        message="Try again, and if it keeps happening, send the reference below to an admin."
        digest={error.digest}
        onRetry={reset}
        homeHref="/"
        homeLabel="Go to home page"
      />
    </main>
  );
}
