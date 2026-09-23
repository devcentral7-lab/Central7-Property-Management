import { redirect } from "next/navigation";

export default function FormOptionsRedirectPage() {
  redirect("/app/properties?tab=options");
}
