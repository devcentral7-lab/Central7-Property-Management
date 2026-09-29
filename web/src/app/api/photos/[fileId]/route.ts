import { NextResponse } from "next/server";
import { getOptionalProfile } from "@/lib/auth";
import {
  downloadPhoto,
  DrivePhotosError,
  isDriveConfigured,
  resolvePhotoRef,
} from "@/lib/drive/photos";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    if (!isDriveConfigured()) {
      return new NextResponse("Photos not configured", { status: 404 });
    }

    const { fileId } = await context.params;
    if (!fileId || fileId.includes("/") || fileId.includes("..")) {
      return new NextResponse("Invalid file", { status: 400 });
    }

    const refNo = await resolvePhotoRef(fileId);
    if (!refNo) {
      return new NextResponse("Not found", { status: 404 });
    }

    const profile = await getOptionalProfile();
    if (!profile) {
      const supabase = await createClient();
      const { data } = await supabase
        .from("property_public_cards")
        .select("ref_no, status")
        .eq("ref_no", refNo)
        .maybeSingle();
      if (!data || data.status !== "Active") {
        return new NextResponse("Forbidden", { status: 403 });
      }
    }

    const { buffer, mimeType } = await downloadPhoto(fileId);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (e) {
    if (e instanceof DrivePhotosError) {
      return new NextResponse(e.message, { status: 404 });
    }
    console.error("photo proxy", e);
    return new NextResponse("Error", { status: 500 });
  }
}
