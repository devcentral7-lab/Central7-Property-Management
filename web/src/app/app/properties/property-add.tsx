import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyForm } from "@/app/app/properties/new/property-form";
import { FormListEditor } from "@/app/app/form-options/form-list-editor";
import { FORM_LIST_META, loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";
import { isDriveConfigured } from "@/lib/drive/photos";

type Props = {
  isAdmin: boolean;
  section: "add" | "options";
};

export async function PropertyAddPanel({ isAdmin, section }: Props) {
  if (section === "options" && !isAdmin) {
    redirect("/app/properties?tab=add");
  }

  const supabase = await createClient();
  const [{ data: complexes }, options, { data: refRow }] = await Promise.all([
    supabase.from("apartment_complexes").select("id, name").order("name"),
    loadFormOptions(),
    section === "add"
      ? supabase.rpc("next_property_ref")
      : Promise.resolve({ data: null }),
  ]);
  const nextRef =
    ((Array.isArray(refRow) ? refRow[0] : refRow) as { ref_no?: string } | null)
      ?.ref_no ?? null;

  const subTabs = [
    { id: "add" as const, label: "Add Listing", href: "/app/properties?tab=add" },
    ...(isAdmin
      ? [
          {
            id: "options" as const,
            label: "Listing Form Options",
            href: "/app/properties?tab=options",
          },
        ]
      : []),
  ];

  return (
    <div className="w-full">
      {subTabs.length > 1 ? (
        <div className="tab-scroll -mx-4 mb-4 px-4 sm:mx-0 sm:px-0">
          {subTabs.map((t) => {
            const active = t.id === section;
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
      ) : null}

      {section === "add" ? (
        <PropertyForm
          complexes={complexes ?? []}
          options={options}
          nextRef={nextRef}
          driveConfigured={isDriveConfigured()}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {FORM_LIST_META.map((meta) => (
            <FormListEditor
              key={meta.key}
              listKey={meta.key}
              title={meta.title}
              initialItems={options[meta.field]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
