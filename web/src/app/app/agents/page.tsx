import { redirect } from "next/navigation";

export default function AgentsRedirectPage() {
  redirect("/app/user-management?tab=partners");
}
