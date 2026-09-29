import { BrandLogo } from "@/components/brand-logo";
import { PublicSearchSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 sm:py-8">
      <div className="mb-6 flex items-center justify-between gap-3 sm:mb-8">
        <span className="flex min-w-0 items-center gap-2.5 font-display text-xl font-semibold text-[var(--brand-deep)] sm:text-2xl">
          <BrandLogo size={36} />
          Central7 Pulse
        </span>
      </div>
      <PublicSearchSkeleton />
    </main>
  );
}
