import { redirect } from "next/navigation";

export default function FormOptionsRedirectPage() {
  redirect("/app/listings?tab=options");
}
