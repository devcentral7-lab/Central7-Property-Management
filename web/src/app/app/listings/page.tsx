import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function ListingsRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const tab = one(sp.tab).toLowerCase();
  if (tab === "options") {
    redirect("/app/properties?tab=options");
  }
  redirect("/app/properties?tab=add");
}
