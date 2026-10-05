import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityButton } from "@/app/app/properties/activity-button";
import { DeletePropertyButton } from "@/app/app/properties/[ref]/delete-property-button";
import { ExportPdfButton } from "@/app/app/properties/export-pdf-button";
import { UpdateStatusButton } from "@/app/app/properties/update-status-button";
import {
  NotesCards,
  PropertyDetailsView,
} from "@/app/app/properties/property-details-view";
import { requireProfile } from "@/lib/auth";
import { loadFormOptions } from "@/lib/form-options";
import { buildPropertyDetails } from "@/lib/property-details";
import { createClient } from "@/lib/supabase/server";

export async function loadPropertyDetail(refNoRaw: string) {
  const refNo = decodeURIComponent(refNoRaw).toUpperCase();
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("ref_no", refNo)
    .maybeSingle();

  if (error || !property) notFound();

  const isOwner =
    property.created_by === profile.id ||
    (!property.created_by &&
      property.created_by_name === profile.display_name);
  const isAdmin = profile.role === "Admin";
  const canEdit = isAdmin;
  const canDelete = isAdmin;

  const [{ data: events }, { data: complex }, options] =
    await Promise.all([
      supabase
        .from("property_status_events")
        .select(
          "id, occurred_at, actor_name, action, comment, assigned_to, requested_platforms",
        )
        .eq("ref_no", refNo)
        .is("archived_at", null)
        .order("occurred_at", { ascending: false })
        .limit(20),
      property.apartment_complex_id
        ? supabase
            .from("apartment_complexes")
            .select("name")
            .eq("id", property.apartment_complex_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      loadFormOptions(),
    ]);

  const details = buildPropertyDetails(property, {
    complexName: complex?.name ?? null,
  });

  return {
    property,
    events: events ?? [],
    details,
    options,
    canEdit,
    canDelete,
    canChangeStatus: isAdmin || isOwner,
  };
}

type DetailProps = {
  refNo: string;
};

export async function PropertyDetailContent({ refNo }: DetailProps) {
  const {
    property,
    events,
    details,
    options,
    canEdit,
    canDelete,
    canChangeStatus,
  } = await loadPropertyDetail(refNo);

  return (
    <PropertyDetailsView
      model={details}
      actions={
        <>
          {canChangeStatus ? (
            <UpdateStatusButton
              refNo={property.ref_no}
              options={options.statusChangeOptions}
              platforms={options.platforms}
              defaultPlatforms={
                events.find(
                  (e) => Array.isArray(e.requested_platforms) && e.requested_platforms.length,
                )?.requested_platforms ?? []
              }
            />
          ) : null}
          <ActivityButton refNo={property.ref_no} events={events} />
          <ExportPdfButton refNo={property.ref_no} />
          {canEdit ? (
            <Link
              href={`/app/properties/${property.ref_no}/edit`}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
            >
              Edit listing
            </Link>
          ) : null}
          {canDelete ? <DeletePropertyButton refNo={property.ref_no} /> : null}
        </>
      }
    >
      <NotesCards comments={property.comments} internalComments={property.internal_comments} />
    </PropertyDetailsView>
  );
}
