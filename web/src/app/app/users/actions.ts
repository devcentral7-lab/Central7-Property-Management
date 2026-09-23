"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateTempPassword } from "@/lib/auth-password";
import type { StaffRole } from "@/lib/constants";

export type StaffListItem = {
  id: string;
  display_name: string;
  mobile_number: string | null;
  role: StaffRole;
  active: boolean;
  email: string | null;
  created_at: string;
  updated_at: string;
};

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") throw new Error("Admin only");
  return profile;
}

export async function listStaffUsers(): Promise<StaffListItem[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select(
      "id, display_name, mobile_number, role, active, created_at, updated_at",
    )
    .order("display_name", { ascending: true });
  if (error) throw error;

  const emailById = new Map<string, string>();
  let page = 1;
  for (;;) {
    const { data, error: uErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (uErr) throw uErr;
    for (const u of data.users) {
      if (u.email) emailById.set(u.id, u.email);
    }
    if (data.users.length < 200) break;
    page += 1;
    if (page > 20) break;
  }

  return (profiles ?? []).map((p) => ({
    id: p.id,
    display_name: p.display_name,
    mobile_number: p.mobile_number,
    role: p.role as StaffRole,
    active: p.active,
    email: emailById.get(p.id) ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
}

export type RegisterStaffResult =
  | {
      ok: true;
      email: string;
      display_name: string;
      tempPassword: string;
      role: StaffRole;
    }
  | { ok: false; error: string };

export async function registerStaffUser(
  formData: FormData,
): Promise<RegisterStaffResult> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Admin only." };
  }

  const display_name = str(formData.get("display_name"));
  const email = str(formData.get("email")).toLowerCase();
  const mobile_number = str(formData.get("mobile_number"));
  const roleRaw = str(formData.get("role"));
  const role: StaffRole = roleRaw === "Admin" ? "Admin" : "User";
  const active =
    formData.get("active") === "on" || formData.get("active") === "true";

  if (!display_name || !email) {
    return { ok: false, error: "Name and email are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Service role not configured.",
    };
  }

  const tempPassword = generateTempPassword();

  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      display_name,
      role: "User",
      mobile_number: mobile_number || null,
    },
  });
  if (authErr) {
    return { ok: false, error: authErr.message };
  }
  if (!created.user) {
    return { ok: false, error: "Auth user was not created." };
  }

  const { error: profileErr } = await admin.from("profiles").upsert({
    id: created.user.id,
    display_name,
    mobile_number: mobile_number || null,
    role,
    active,
  });
  if (profileErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: profileErr.message };
  }

  revalidatePath("/app/user-management");
  await logAudit({
    category: "staff",
    action: "create",
    subjectType: "profile",
    subjectId: created.user.id,
    subjectLabel: display_name,
    summary: `Created staff ${display_name} (${role})`,
    details: { email, role, active },
  });
  return {
    ok: true,
    email,
    display_name,
    tempPassword,
    role,
  };
}

export async function setStaffActive(
  userId: string,
  active: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminProfile = await requireAdmin();
    if (adminProfile.id === userId && !active) {
      return { ok: false, error: "You cannot deactivate your own account." };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ active })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app/user-management");
    await logAudit({
      category: "staff",
      action: active ? "activate" : "deactivate",
      subjectType: "profile",
      subjectId: userId,
      summary: `${active ? "Activated" : "Deactivated"} staff account`,
      details: { user_id: userId, active },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function setStaffRole(
  userId: string,
  role: StaffRole,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminProfile = await requireAdmin();
    if (adminProfile.id === userId && role !== "Admin") {
      return { ok: false, error: "You cannot remove your own Admin role." };
    }
    const admin = createAdminClient();
    const { error } = await admin
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app/user-management");
    await logAudit({
      category: "staff",
      action: "set_role",
      subjectType: "profile",
      subjectId: userId,
      summary: `Set staff role to ${role}`,
      details: { user_id: userId, role },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export type UpdateStaffResult = { ok: true } | { ok: false; error: string };

export async function updateStaffUser(
  formData: FormData,
): Promise<UpdateStaffResult> {
  try {
    const adminProfile = await requireAdmin();
    const userId = str(formData.get("user_id"));
    const display_name = str(formData.get("display_name"));
    const email = str(formData.get("email")).toLowerCase();
    const mobile_number = str(formData.get("mobile_number"));
    const roleRaw = str(formData.get("role"));
    const role: StaffRole = roleRaw === "Admin" ? "Admin" : "User";
    const active = formData.get("active") === "on" || formData.get("active") === "true";

    if (!userId) return { ok: false, error: "Missing user id." };
    if (!display_name || !email) {
      return { ok: false, error: "Name and email are required." };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    if (adminProfile.id === userId && role !== "Admin") {
      return { ok: false, error: "You cannot remove your own Admin role." };
    }
    if (adminProfile.id === userId && !active) {
      return { ok: false, error: "You cannot deactivate your own account." };
    }

    const admin = createAdminClient();

    const { error: profileErr } = await admin
      .from("profiles")
      .update({
        display_name,
        mobile_number: mobile_number || null,
        role,
        active,
      })
      .eq("id", userId);
    if (profileErr) return { ok: false, error: profileErr.message };

    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
      user_metadata: {
        display_name,
        mobile_number: mobile_number || null,
        role,
      },
    });
    if (authErr) return { ok: false, error: authErr.message };

    revalidatePath("/app/user-management");
    await logAudit({
      category: "staff",
      action: "update",
      subjectType: "profile",
      subjectId: userId,
      subjectLabel: display_name,
      summary: `Updated staff ${display_name}`,
      details: { email, role, active },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export type ResetPasswordResult =
  | { ok: true; tempPassword: string; email: string }
  | { ok: false; error: string };

export async function resetStaffPassword(
  userId: string,
): Promise<ResetPasswordResult> {
  try {
    await requireAdmin();
    if (!userId) return { ok: false, error: "Missing user id." };

    const admin = createAdminClient();
    const tempPassword = generateTempPassword();

    const { data: authUser, error: getErr } =
      await admin.auth.admin.getUserById(userId);
    if (getErr) return { ok: false, error: getErr.message };
    if (!authUser.user?.email) {
      return { ok: false, error: "User has no email." };
    }

    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: tempPassword,
    });
    if (error) return { ok: false, error: error.message };

    revalidatePath("/app/user-management");
    return {
      ok: true,
      tempPassword,
      email: authUser.user.email,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deleteStaffUser(
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminProfile = await requireAdmin();
    if (!userId) return { ok: false, error: "Missing user id." };
    if (adminProfile.id === userId) {
      return { ok: false, error: "You cannot delete your own account." };
    }

    const admin = createAdminClient();
    // profiles cascade from auth.users
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath("/app/user-management");
    await logAudit({
      category: "staff",
      action: "delete",
      subjectType: "profile",
      subjectId: userId,
      summary: `Deleted staff account`,
      details: { user_id: userId },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; error: string };

export async function changePassword(
  formData: FormData,
): Promise<ChangePasswordResult> {
  try {
    await requireProfile();
  } catch {
    return { ok: false, error: "Sign in required." };
  }

  const currentPassword = str(formData.get("current_password"));
  const newPassword = str(formData.get("new_password"));
  const confirmPassword = str(formData.get("confirm_password"));

  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Current and new password are required." };
  }
  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { ok: false, error: "New password and confirmation do not match." };
  }
  if (newPassword === currentPassword) {
    return { ok: false, error: "New password must be different from the current one." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, error: "No email on this account." };
  }

  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyErr) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  await logAudit({
    category: "auth",
    action: "password_change",
    subjectType: "session",
    subjectLabel: user.email,
    summary: "Changed account password",
    details: { auth_user_id: user.id },
  });
  return { ok: true };
}
