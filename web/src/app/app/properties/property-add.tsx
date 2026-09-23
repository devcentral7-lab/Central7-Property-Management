import Link from "next/link";
import { redirect } from "next/navigation";
import { PropertyForm } from "@/app/app/properties/new/property-form";
import { FormListEditor } from "@/app/app/form-options/form-list-editor";
import { FORM_LIST_META, loadFormOptions } from "@/lib/form-options";
import { createClient } from "@/lib/supabase/server";

type Props = {
  isAdmin: boolean;
  section: "add" | "options";
};

export async function PropertyAddPanel({ isAdmin, section }: Props) {
  if (section === "options" && !isAdmin) {
    redirect("/app/properties?tab=add");
  }

  const supabase = await createClient();
  const [{ data: complexes }, options] = await Promise.all([
    supabase.from("apartment_complexes").select("id, name").order("name"),
    loadFormOptions(),
  ]);

  const subTabs = [
    { id: "add" as const, label: "Add listing", href: "/app/properties?tab=add" },
    ...(isAdmin
      ? [
          {
            id: "options" as const,
            label: "Listing form options",
            href: "/app/properties?tab=options",
          },
        ]
      : []),
  ];

  return (
    <div className="w-full">
      {subTabs.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
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
        <PropertyForm complexes={complexes ?? []} options={options} />
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
