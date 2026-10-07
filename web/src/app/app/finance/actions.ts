"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIES,
  DATE_RE,
  formatLkr,
  REVENUE_TYPES,
  UUID_RE,
} from "@/lib/finance-shared";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type InvoiceInput = {
  id?: string | null;
  invoice_no: string;
  invoice_date: string;
  sent_date: string;
  customer_name: string;
  details: string;
  category: string;
  revenue_type: string;
  amount: number;
  c7_booking: number | null;
  revenue_month: string;
  property_ref: string;
  notes: string;
  agents: { agent_id: string; amount: number }[];
  /** New invoices only: payment already received. */
  payment?: { amount: number; paid_on: string; reference: string } | null;
};

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "Admin") throw new Error("Only Admin can manage finance");
  return profile;
}

function fail(e: unknown): { ok: false; error: string } {
  const message = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "Something went wrong";
  return { ok: false, error: message.replace(/^.*?ERROR:\s*/, "") };
}

function revalidateFinance(invoiceId?: string) {
  revalidatePath("/app/finance");
  if (invoiceId) revalidatePath(`/app/finance/invoices/${invoiceId}`);
}

export async function getNextInvoiceNo(date: string): Promise<string> {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.rpc("finance_next_invoice_no", {
    p_date: DATE_RE.test(date) ? date : null,
  });
  return String(data ?? "");
}

export async function saveInvoice(input: InvoiceInput): Promise<ActionResult<{ id: string }>> {
  try {
    const profile = await requireAdmin();
    const isNew = !input.id;
    if (input.id && !UUID_RE.test(input.id)) throw new Error("Invalid invoice");
    if (!DATE_RE.test(input.invoice_date)) throw new Error("Invoice date is required");
    if (!(CATEGORIES as readonly string[]).includes(input.category)) throw new Error("Pick a category");
    if (!(REVENUE_TYPES as readonly string[]).includes(input.revenue_type)) throw new Error("Pick a revenue type");
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid amount");
    const agents = input.agents
      .filter((a) => UUID_RE.test(a.agent_id) && Number(a.amount) > 0)
      .map((a) => ({ agent_id: a.agent_id, amount: Math.round(Number(a.amount) * 100) / 100 }));
    const month = /^\d{4}-\d{2}$/.test(input.revenue_month) ? `${input.revenue_month}-01` : "";

    const supabase = await createClient();
    const { data: id, error } = await supabase.rpc("finance_save_invoice", {
      p_id: input.id || null,
      p_data: {
        invoice_no: input.invoice_no.trim(),
        invoice_date: input.invoice_date,
        sent_date: DATE_RE.test(input.sent_date) ? input.sent_date : "",
        customer_name: input.customer_name,
        details: input.details,
        category: input.category,
        revenue_type: input.revenue_type,
        amount,
        c7_booking: input.c7_booking === null || Number.isNaN(Number(input.c7_booking)) ? "" : Number(input.c7_booking),
        revenue_month: month,
        property_ref: input.property_ref,
        notes: input.notes,
      },
      p_agents: agents,
    });
    if (error) throw error;
    const invoiceId = String(id);

    let paymentNote = "";
    if (isNew && input.payment && Number(input.payment.amount) > 0) {
      const { error: payErr } = await supabase.rpc("finance_add_payment", {
        p_invoice_id: invoiceId,
        p_paid_on: DATE_RE.test(input.payment.paid_on) ? input.payment.paid_on : null,
        p_amount: Number(input.payment.amount),
        p_reference: input.payment.reference,
        p_notes: null,
      });
      if (payErr) {
        revalidateFinance(invoiceId);
        return { ok: false, error: `Invoice saved, but the payment wasn't: ${fail(payErr).error}` };
      }
      paymentNote = `, ${formatLkr(input.payment.amount)} received`;
    }

    await logAudit({
      category: "finance",
      action: isNew ? "invoice_create" : "invoice_update",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "invoice",
      subjectId: invoiceId,
      subjectLabel: input.invoice_no.trim(),
      summary: `${isNew ? "Created" : "Updated"} invoice ${input.invoice_no.trim()} · ${formatLkr(amount)}${paymentNote}`,
      details: {
        customer: input.customer_name || null,
        category: input.category,
        type: input.revenue_type,
        agents: agents.length || undefined,
      },
    });

    revalidateFinance(invoiceId);
    return { ok: true, data: { id: invoiceId } };
  } catch (e) {
    return fail(e);
  }
}

export async function setInvoiceVoid(
  id: string,
  invoiceNo: string,
  voided: boolean,
  reason: string,
): Promise<ActionResult> {
  try {
    const profile = await requireAdmin();
    if (!UUID_RE.test(id)) throw new Error("Invalid invoice");
    const supabase = await createClient();
    const { error } = await supabase.rpc("finance_void_invoice", {
      p_id: id,
      p_void: voided,
      p_reason: reason,
    });
    if (error) throw error;
    await logAudit({
      category: "finance",
      action: voided ? "invoice_void" : "invoice_restore",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "invoice",
      subjectId: id,
      subjectLabel: invoiceNo,
      summary: `${voided ? "Voided" : "Restored"} invoice ${invoiceNo}`,
      details: voided && reason ? { reason } : undefined,
    });
    revalidateFinance(id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function addPayment(input: {
  invoice_id: string;
  invoice_no: string;
  amount: number;
  paid_on: string;
  reference: string;
  notes: string;
}): Promise<ActionResult> {
  try {
    const profile = await requireAdmin();
    if (!UUID_RE.test(input.invoice_id)) throw new Error("Invalid invoice");
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter the amount received");
    const supabase = await createClient();
    const { error } = await supabase.rpc("finance_add_payment", {
      p_invoice_id: input.invoice_id,
      p_paid_on: DATE_RE.test(input.paid_on) ? input.paid_on : null,
      p_amount: amount,
      p_reference: input.reference,
      p_notes: input.notes,
    });
    if (error) throw error;
    await logAudit({
      category: "finance",
      action: "payment_add",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "invoice",
      subjectId: input.invoice_id,
      subjectLabel: input.invoice_no,
      summary: `Recorded ${formatLkr(amount)} received for ${input.invoice_no}`,
      details: { paid_on: input.paid_on || null, reference: input.reference || null },
    });
    revalidateFinance(input.invoice_id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePayment(input: {
  id: string;
  invoice_id: string;
  invoice_no: string;
  amount: number;
}): Promise<ActionResult> {
  try {
    const profile = await requireAdmin();
    if (!UUID_RE.test(input.id)) throw new Error("Invalid payment");
    const supabase = await createClient();
    const { error } = await supabase.rpc("finance_delete_payment", { p_id: input.id });
    if (error) throw error;
    await logAudit({
      category: "finance",
      action: "payment_delete",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "invoice",
      subjectId: input.invoice_id,
      subjectLabel: input.invoice_no,
      summary: `Removed ${formatLkr(input.amount)} payment from ${input.invoice_no}`,
    });
    revalidateFinance(input.invoice_id);
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}

export async function saveAgent(input: {
  id?: string | null;
  name: string;
  profile_id: string | null;
  sales_agent: boolean;
  active: boolean;
}): Promise<ActionResult<{ id: string }>> {
  try {
    const profile = await requireAdmin();
    const name = input.name.trim();
    if (!name) throw new Error("Enter the agent's name");
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("finance_save_agent", {
      p_id: input.id && UUID_RE.test(input.id) ? input.id : null,
      p_name: name,
      p_profile_id: input.profile_id && UUID_RE.test(input.profile_id) ? input.profile_id : null,
      p_sales_agent: input.sales_agent,
      p_active: input.active,
    });
    if (error) throw error;
    await logAudit({
      category: "finance",
      action: input.id ? "agent_update" : "agent_create",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "finance_agent",
      subjectId: String(data),
      subjectLabel: name,
      summary: `${input.id ? "Updated" : "Added"} finance agent ${name}`,
      details: { sales_agent: input.sales_agent, active: input.active },
    });
    revalidatePath("/app/finance");
    revalidatePath("/app/finance/settings");
    return { ok: true, data: { id: String(data) } };
  } catch (e) {
    return fail(e);
  }
}

export async function saveTargets(
  year: number,
  targets: { agent_id: string; name: string; target: number | null }[],
): Promise<ActionResult> {
  try {
    const profile = await requireAdmin();
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("Invalid year");
    const supabase = await createClient();
    for (const t of targets) {
      if (!UUID_RE.test(t.agent_id)) continue;
      const value = t.target === null || Number.isNaN(Number(t.target)) ? null : Number(t.target);
      const { error } = await supabase.rpc("finance_set_target", {
        p_agent_id: t.agent_id,
        p_year: year,
        p_target: value,
      });
      if (error) throw error;
    }
    await logAudit({
      category: "finance",
      action: "targets_update",
      actorName: profile.display_name,
      actorKind: "staff",
      subjectType: "finance_targets",
      subjectLabel: String(year),
      summary: `Updated ${year} agent targets`,
      details: Object.fromEntries(targets.map((t) => [t.name, t.target === null ? "none" : formatLkr(t.target)])),
    });
    revalidatePath("/app/finance");
    revalidatePath("/app/finance/settings");
    return { ok: true, data: undefined };
  } catch (e) {
    return fail(e);
  }
}
