import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityButton } from "@/app/app/properties/activity-button";
import { ExportPdfButton } from "@/app/app/properties/export-pdf-button";
import { UpdateStatusButton } from "@/app/app/properties/update-status-button";
import {
  NotesCards,
  PropertyDetailsView,
} from "@/app/app/properties/property-details-view";
import { requireProfile } from "@/lib/auth";
import { loadFormOptions } from "@/lib/form-options";
import { loadPropertyActivity } from "@/lib/property-activity";
import { buildPropertyDetails } from "@/lib/property-details";
import {
  isSocialOnlyViewer,
  propertyOnSocialQueue,
} from "@/lib/social-property-access";
import { loadSocialMediaStatus } from "@/lib/social-status";
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

  const socialOnly = isSocialOnlyViewer(profile);
  if (socialOnly && !(await propertyOnSocialQueue(supabase, refNo))) {
    notFound();
  }

  const isOwner =
    property.created_by === profile.id ||
    (!property.created_by &&
      property.created_by_name === profile.display_name);
  const isAdmin = profile.role === "Admin";
  const canEdit = isAdmin && !socialOnly;

  const [events, { data: complex }, options, social] =
    await Promise.all([
      socialOnly ? Promise.resolve([]) : loadPropertyActivity(refNo),
      property.apartment_complex_id
        ? supabase
            .from("apartment_complexes")
            .select("name")
            .eq("id", property.apartment_complex_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      loadFormOptions(),
      loadSocialMediaStatus(refNo),
    ]);

  const details = {
    ...buildPropertyDetails(property, {
      complexName: complex?.name ?? null,
      hideContact: socialOnly,
    }),
    social,
  };

  return {
    property: socialOnly
      ? { ...property, internal_comments: null, contact_name: null, contact_phone_1: null, contact_phone_2: null, contact_email: null, contact_type: null }
      : property,
    events,
    details,
    options,
    canEdit,
    canChangeStatus: !socialOnly && (isAdmin || isOwner),
    socialOnly,
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
    canChangeStatus,
    socialOnly,
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
                events.find((e) => e.requested_platforms.length)?.requested_platforms ?? []
              }
            />
          ) : null}
          {!socialOnly ? <ActivityButton refNo={property.ref_no} events={events} /> : null}
          {!socialOnly ? <ExportPdfButton refNo={property.ref_no} /> : null}
          {canEdit ? (
            <Link
              href={`/app/properties/${property.ref_no}/edit`}
              className="rounded-full border border-[var(--line)] px-4 py-2 text-sm font-semibold hover:bg-[var(--bg-accent)]"
            >
              Edit listing
            </Link>
          ) : null}
        </>
      }
    >
      <NotesCards
        comments={property.comments}
        internalComments={socialOnly ? null : property.internal_comments}
      />
    </PropertyDetailsView>
  );
}
