"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/error-panel";

export default function AppError({
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
    <ErrorPanel
      title="This page couldn't load"
      message="Something went wrong on our side. Try again, and if it keeps happening, send the reference below to an admin."
      digest={error.digest}
      onRetry={reset}
      homeHref="/app"
    />
  );
}
