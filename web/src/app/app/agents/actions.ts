"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { generateTempPassword } from "@/lib/auth-password";

export type PartnerApprovalStatus = "Pending" | "Approved" | "Rejected";

export type PartnerListItem = {
  id: string;
  auth_user_id: string | null;
  company_name: string | null;
  contact_person: string | null;
  contact_number: string | null;
  email: string | null;
  address: string | null;
  username: string;
  status: PartnerApprovalStatus;
  active: boolean;
  approved_by: string | null;
  approved_at: string | null;
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

function parsePartnerFields(formData: FormData) {
  const statusRaw = str(formData.get("status"));
  const status: PartnerApprovalStatus =
    statusRaw === "Approved" || statusRaw === "Rejected" ? statusRaw : "Pending";
  return {
    company_name: str(formData.get("company_name")) || null,
    contact_person: str(formData.get("contact_person")) || null,
    contact_number: str(formData.get("contact_number")) || null,
    email: str(formData.get("email")).toLowerCase() || null,
    address: str(formData.get("address")) || null,
    username: str(formData.get("username")),
    status,
    active:
      formData.get("active") === "on" || formData.get("active") === "true",
    create_login:
      formData.get("create_login") === "on" ||
      formData.get("create_login") === "true",
  };
}

export async function listPartners(): Promise<PartnerListItem[]> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("users")
    .select(
      "id, auth_user_id, company_name, contact_person, contact_number, email, address, username, status, active, approved_by, approved_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PartnerListItem[];
}

export type RegisterPartnerResult =
  | {
      ok: true;
      username: string;
      email: string | null;
      tempPassword: string | null;
    }
  | { ok: false; error: string };

export async function registerPartner(
  formData: FormData,
): Promise<RegisterPartnerResult> {
  try {
    const adminProfile = await requireAdmin();
    const fields = parsePartnerFields(formData);

    if (!fields.username) {
      return { ok: false, error: "Username is required." };
    }
    if (fields.create_login) {
      if (!fields.email) {
        return { ok: false, error: "Email is required when creating a login." };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
        return { ok: false, error: "Enter a valid email address." };
      }
    }

    const admin = createAdminClient();
    let authUserId: string | null = null;
    let tempPassword: string | null = null;

    if (fields.create_login && fields.email) {
      tempPassword = generateTempPassword();
      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email: fields.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          role: "Agent",
          display_name: fields.contact_person || fields.username,
        },
      });
      if (authErr) return { ok: false, error: authErr.message };
      authUserId = created.user?.id ?? null;
      if (!authUserId) {
        return { ok: false, error: "Auth user was not created." };
      }
    }

    const approved =
      fields.status === "Approved"
        ? {
            approved_by: adminProfile.id,
            approved_at: new Date().toISOString(),
          }
        : { approved_by: null, approved_at: null };

    const { error } = await admin.from("users").insert({
      auth_user_id: authUserId,
      company_name: fields.company_name,
      contact_person: fields.contact_person,
      contact_number: fields.contact_number,
      email: fields.email,
      address: fields.address,
      username: fields.username,
      status: fields.status,
      active: fields.active,
      ...approved,
    });

    if (error) {
      if (authUserId) await admin.auth.admin.deleteUser(authUserId);
      return { ok: false, error: error.message };
    }

    revalidatePath("/app/user-management");
    await logAudit({
      category: "partner",
      action: "create",
      subjectType: "partner",
      subjectLabel: fields.username,
      summary: `Created partner ${fields.company_name || fields.username} (${fields.status})`,
      details: {
        username: fields.username,
        status: fields.status,
        active: fields.active,
        login_created: Boolean(authUserId),
      },
    });
    return {
      ok: true,
      username: fields.username,
      email: fields.email,
      tempPassword,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function updatePartner(
  formData: FormData,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const adminProfile = await requireAdmin();
    const id = str(formData.get("partner_id"));
    if (!id) return { ok: false, error: "Missing partner id." };

    const fields = parsePartnerFields(formData);
    if (!fields.username) {
      return { ok: false, error: "Username is required." };
    }
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      return { ok: false, error: "Enter a valid email address." };
    }

    const admin = createAdminClient();
    const { data: existing, error: getErr } = await admin
      .from("users")
      .select("id, status, approved_by, approved_at, auth_user_id, email")
      .eq("id", id)
      .single();
    if (getErr || !existing) {
      return { ok: false, error: getErr?.message || "Partner not found." };
    }

    let approved_by = existing.approved_by as string | null;
    let approved_at = existing.approved_at as string | null;
    if (fields.status === "Approved" && existing.status !== "Approved") {
      approved_by = adminProfile.id;
      approved_at = new Date().toISOString();
    }
    if (fields.status !== "Approved") {
      approved_by = null;
      approved_at = null;
    }

    const { error } = await admin
      .from("users")
      .update({
        company_name: fields.company_name,
        contact_person: fields.contact_person,
        contact_number: fields.contact_number,
        email: fields.email,
        address: fields.address,
        username: fields.username,
        status: fields.status,
        active: fields.active,
        approved_by,
        approved_at,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    if (existing.auth_user_id && fields.email && fields.email !== existing.email) {
      const { error: authErr } = await admin.auth.admin.updateUserById(
        existing.auth_user_id,
        {
          email: fields.email,
          email_confirm: true,
          user_metadata: {
            role: "Agent",
            display_name: fields.contact_person || fields.username,
          },
        },
      );
      if (authErr) return { ok: false, error: authErr.message };
    }

    revalidatePath("/app/user-management");
    await logAudit({
      category: "partner",
      action: "update",
      subjectType: "partner",
      subjectId: id,
      subjectLabel: fields.username,
      summary: `Updated partner ${fields.company_name || fields.username}`,
      details: {
        status: fields.status,
        active: fields.active,
      },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function resetPartnerPassword(
  partnerId: string,
): Promise<
  | { ok: true; tempPassword: string; email: string }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data: partner, error } = await admin
      .from("users")
      .select("auth_user_id, email")
      .eq("id", partnerId)
      .single();
    if (error || !partner) {
      return { ok: false, error: error?.message || "Partner not found." };
    }
    if (!partner.auth_user_id) {
      return { ok: false, error: "This partner has no login yet." };
    }

    const tempPassword = generateTempPassword();
    const { data: authUser, error: getErr } = await admin.auth.admin.getUserById(
      partner.auth_user_id,
    );
    if (getErr) return { ok: false, error: getErr.message };
    const email = authUser.user?.email || partner.email;
    if (!email) return { ok: false, error: "No email on this partner login." };

    const { error: upErr } = await admin.auth.admin.updateUserById(
      partner.auth_user_id,
      { password: tempPassword },
    );
    if (upErr) return { ok: false, error: upErr.message };

    revalidatePath("/app/user-management");
    return { ok: true, tempPassword, email };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function createPartnerLogin(
  partnerId: string,
): Promise<
  | { ok: true; tempPassword: string; email: string }
  | { ok: false; error: string }
> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data: partner, error } = await admin
      .from("users")
      .select("*")
      .eq("id", partnerId)
      .single();
    if (error || !partner) {
      return { ok: false, error: error?.message || "Partner not found." };
    }
    if (partner.auth_user_id) {
      return { ok: false, error: "Login already exists for this partner." };
    }
    if (!partner.email) {
      return { ok: false, error: "Add an email before creating a login." };
    }

    const tempPassword = generateTempPassword();
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: partner.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        role: "Agent",
        display_name: partner.contact_person || partner.username,
      },
    });
    if (authErr) return { ok: false, error: authErr.message };
    if (!created.user) return { ok: false, error: "Auth user was not created." };

    const { error: linkErr } = await admin
      .from("users")
      .update({ auth_user_id: created.user.id })
      .eq("id", partnerId);
    if (linkErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: linkErr.message };
    }

    revalidatePath("/app/user-management");
    return { ok: true, tempPassword, email: partner.email };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

export async function deletePartner(
  partnerId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { data: partner, error } = await admin
      .from("users")
      .select("auth_user_id")
      .eq("id", partnerId)
      .single();
    if (error || !partner) {
      return { ok: false, error: error?.message || "Partner not found." };
    }

    const { error: delErr } = await admin.from("users").delete().eq("id", partnerId);
    if (delErr) return { ok: false, error: delErr.message };

    if (partner.auth_user_id) {
      await admin.auth.admin.deleteUser(partner.auth_user_id);
    }

    revalidatePath("/app/user-management");
    await logAudit({
      category: "partner",
      action: "delete",
      subjectType: "partner",
      subjectId: partnerId,
      summary: "Deleted partner",
      details: { partner_id: partnerId },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
