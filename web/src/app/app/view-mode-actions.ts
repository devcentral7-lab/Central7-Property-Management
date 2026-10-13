"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRealAdmin, requireProfile } from "@/lib/auth";
import { VIEW_AS_COOKIE } from "@/lib/view-mode";

export async function setViewMode(formData: FormData) {
  const profile = await requireProfile();
  const store = await cookies();
  if (formData.get("mode") === "user") {
    if (!isRealAdmin(profile)) throw new Error("Only Admins can switch views.");
    store.set(VIEW_AS_COOKIE, "user", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    store.delete(VIEW_AS_COOKIE);
  }
  revalidatePath("/app", "layout");
  redirect("/app");
}
