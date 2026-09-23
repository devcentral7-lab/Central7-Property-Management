import { redirect } from "next/navigation";

/** Republish queue is hidden from all roles — keep route as a soft redirect. */
export default function RepublishQueuePage() {
  redirect("/app");
}
