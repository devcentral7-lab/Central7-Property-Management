import { redirect } from "next/navigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

export default async function MyPropertiesRedirectPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set("tab", "mine");
  const page = one(sp.page);
  const user = one(sp.user);
  if (page) params.set("page", page);
  if (user) params.set("user", user);
  redirect(`/app/properties?${params.toString()}`);
}
