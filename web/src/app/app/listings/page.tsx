import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyForm } from "@/app/app/properties/new/property-form";
import { FormListEditor } from "@/app/app/form-options/form-list-editor";
import { requireProfile } from "@/lib/auth";
import { FORM_LIST_META, loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "Admin";
  const sp = await searchParams;
  const tabRaw = one(sp.tab).toLowerCase();
  const tab =
    tabRaw === "options" && isAdmin ? "options" : "add";

  if (tabRaw === "options" && !isAdmin) {
    redirect("/app/listings");
  }

  const supabase = await createClient();
  const [{ data: complexes }, options] = await Promise.all([
    supabase.from("apartment_complexes").select("id, name").order("name"),
    loadFormOptions(),
  ]);

  const tabs = [
    { id: "add" as const, label: "Add listing", href: "/app/listings" },
    ...(isAdmin
      ? [
          {
            id: "options" as const,
            label: "Listing form options",
            href: "/app/listings?tab=options",
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl font-semibold">Listings</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {tab === "add"
          ? "Create a new property listing, or paste notes for AI fill."
          : "Control dropdowns and amenity checkboxes used on the listing form."}
      </p>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-[var(--line)] pb-3">
        {tabs.map((t) => {
          const active = t.id === tab;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--bg-accent)] hover:text-[var(--ink)]"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        {tab === "add" ? (
          <PropertyForm complexes={complexes ?? []} options={options} />
        ) : (
          <div className="space-y-8">
            <p className="text-sm text-[var(--muted)]">
              Changes apply immediately for all staff. Removing an option hides
              it from new edits; existing listings keep their saved values.
            </p>
            {FORM_LIST_META.map((meta) => (
              <FormListEditor
                key={meta.key}
                listKey={meta.key}
                title={meta.title}
                description={meta.description}
                initialItems={options[meta.field]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
