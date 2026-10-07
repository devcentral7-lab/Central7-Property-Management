"use client";

import { useEffect } from "react";
import { ErrorPanel } from "@/components/error-panel";
import "./globals.css";

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen bg-[var(--bg)] antialiased">
        <ErrorPanel
          title="Central7 Pulse couldn't load"
          message="Try again, and if it keeps happening, send the reference below to an admin."
          digest={error.digest}
          onRetry={reset}
          homeHref="/"
          homeLabel="Go to home page"
        />
      </body>
    </html>
  );
}
