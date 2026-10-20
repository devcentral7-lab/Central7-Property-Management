import { NextResponse, type NextRequest } from "next/server";
import { getOptionalProfile } from "@/lib/auth";
import {
  autocompleteSriLankaCities,
  isPlacesConfigured,
} from "@/lib/places/sri-lanka-cities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Staff-only Places Autocomplete proxy; always restricted to Sri Lanka. */
export async function GET(req: NextRequest) {
  const profile = await getOptionalProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPlacesConfigured()) {
    return NextResponse.json({ cities: [], configured: false });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ cities: [], configured: true });
  }

  try {
    const cities = await autocompleteSriLankaCities(q);
    return NextResponse.json({ cities, configured: true });
  } catch (e) {
    console.error("places autocomplete", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Places lookup failed",
        cities: [],
        configured: true,
      },
      { status: 502 },
    );
  }
}
