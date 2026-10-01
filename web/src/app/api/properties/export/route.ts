import { NextResponse, type NextRequest } from "next/server";
import { logAudit } from "@/lib/audit";
import { getOptionalProfile } from "@/lib/auth";
import {
  buildPropertiesWorkbook,
  type ExportPropertyRow,
} from "@/lib/export/properties-xlsx";
import {
  applyMineFilters,
  describeMineFilters,
  mineFiltersFromParams,
} from "@/lib/my-properties-filters";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BATCH = 1000;

const COLUMNS = [
  "ref_no",
  "status",
  "opportunity_type",
  "property_type",
  "property_subtype",
  "city",
  "address",
  "apartment_floor",
  "view",
  "bedrooms",
  "bathrooms",
  "floor_area_sqft",
  "land_size_perch",
  "number_of_floors",
  "parking_spaces",
  "age_years",
  "furnished",
  "type_attributes",
  "currency",
  "price_total",
  "price_per_perch",
  "price_per_sqft",
  "budget",
  "amenities",
  "contact_type",
  "contact_name",
  "contact_phone_1",
  "contact_phone_2",
  "contact_email",
  "do_not_publish",
  "comments",
  "internal_comments",
  "created_at",
  "updated_at",
  "apartment_complexes(name)",
].join(", ");

function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "listings"
  );
}

export async function GET(req: NextRequest) {
  const profile = await getOptionalProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get("user")?.trim();
  const owner =
    profile.role === "Admin" && requested ? requested : profile.display_name;
  const filters = mineFiltersFromParams(Object.fromEntries(req.nextUrl.searchParams));
  const filterSummary = describeMineFilters(filters);

  try {
    const supabase = await createClient();
    const rows: ExportPropertyRow[] = [];
    for (let from = 0; ; from += BATCH) {
      const { data, error } = await applyMineFilters(
        supabase.from("properties").select(COLUMNS).eq("created_by_name", owner),
        filters,
      )
        .order("created_at", { ascending: false })
        .order("ref_no", { ascending: false })
        .range(from, from + BATCH - 1);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as unknown as ExportPropertyRow[]));
      if (!data || data.length < BATCH) break;
    }

    const exportedAt = new Date();
    const xlsx = await buildPropertiesWorkbook(rows, {
      owner,
      exportedBy: profile.display_name,
      exportedAt,
      filters: filterSummary,
    });

    await logAudit({
      category: "property",
      action: "export",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "property_export",
      subjectLabel: owner,
      summary: `Exported ${rows.length} ${filterSummary ? "filtered " : ""}listings added by ${owner} to Excel`,
      details: { owner, count: rows.length, ...(filterSummary ? { filters: filterSummary } : {}) },
    });

    const stamp = exportedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });
    const filename = `central7-listings-${fileSlug(owner)}${filterSummary ? "-filtered" : ""}-${stamp}.xlsx`;
    return new NextResponse(new Uint8Array(xlsx), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not export listings" },
      { status: 500 },
    );
  }
}
