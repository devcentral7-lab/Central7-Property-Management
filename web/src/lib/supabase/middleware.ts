import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLogin = path === "/login" || path.startsWith("/login/");
  const isAuthContinue = path.startsWith("/auth/");
  const isHome = path === "/";
  const isPublic =
    path.startsWith("/search") || path.startsWith("/p/");
  const isStaffApp = path.startsWith("/app");
  const isAgentApp = path.startsWith("/agent");

  if (isHome) {
    const url = request.nextUrl.clone();
    url.pathname = user ? "/auth/continue" : "/login";
    return NextResponse.redirect(url);
  }

  if (!user && (isStaffApp || isAgentApp || isAuthContinue)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path.startsWith("/auth") ? "/auth/continue" : path);
    return NextResponse.redirect(url);
  }

  if (!user && !isLogin && !isPublic) {
    // allow other unknown public paths through; protected prefixes handled above
  }

  if (user && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/continue";
    return NextResponse.redirect(url);
  }

  if (user && isStaffApp) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, active")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.active) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/continue";
      return NextResponse.redirect(url);
    }
  }

  if (user && isAgentApp) {
    const { data: agent } = await supabase
      .from("users")
      .select("id, status, active")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (!(agent?.status === "Approved" && agent.active)) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/continue";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
