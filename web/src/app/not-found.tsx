import { ErrorPanel } from "@/components/error-panel";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[var(--bg)]">
      <ErrorPanel
        title="Page not found"
        message="The page you're looking for doesn't exist or has been moved."
        homeHref="/app"
      />
    </main>
  );
}
