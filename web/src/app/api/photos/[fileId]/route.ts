import { NextResponse } from "next/server";
import { getOptionalProfile } from "@/lib/auth";
import {
  downloadPhoto,
  DrivePhotosError,
  isDriveConfigured,
  resolvePhotoRef,
} from "@/lib/drive/photos";
import { resizeToJpeg } from "@/lib/drive/resize";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** `?w=` thumbnail widths; anything else serves the original file. */
const THUMB_WIDTHS = new Set([400, 800, 1600]);

export async function GET(
  request: Request,
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

    const profile = await getOptionalProfile();
    // Guests only get images on Active listings; staff can download any attachment.
    const imagesOnly = !profile;
    const refNo = await resolvePhotoRef(fileId, imagesOnly);
    if (!refNo) {
      return new NextResponse("Not found", { status: 404 });
    }

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

    const { buffer, mimeType, name } = await downloadPhoto(fileId, imagesOnly);
    const width = Number(new URL(request.url).searchParams.get("w"));
    let body = buffer;
    let contentType = mimeType;
    if (imagesOnly || mimeType.startsWith("image/")) {
      if (THUMB_WIDTHS.has(width) && mimeType !== "image/gif") {
        try {
          body = await resizeToJpeg(buffer, width);
          contentType = "image/jpeg";
        } catch {
          /* serve the original if it can't be decoded */
        }
      }
    }
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    };
    if (!mimeType.startsWith("image/")) {
      headers["Content-Disposition"] = `attachment; filename="${name.replace(/"/g, "")}"`;
    }
    return new NextResponse(new Uint8Array(body), { status: 200, headers });
  } catch (e) {
    if (e instanceof DrivePhotosError) {
      return new NextResponse(e.message, { status: 404 });
    }
    console.error("photo proxy", e);
    return new NextResponse("Error", { status: 500 });
  }
}
