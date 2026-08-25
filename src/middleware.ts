import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/src/lib/supabase/database.types";
import { getPublicSupabaseEnvironment } from "@/src/lib/supabase/env";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const { publishableKey, url } = getPublicSupabaseEnvironment();
  const client = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, options, value } of cookiesToSet) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await client.auth.getUser();
  const loginRoute = request.nextUrl.pathname === "/login";
  const pageNavigation = request.method === "GET" || request.method === "HEAD";

  if (!user && !loginRoute && pageNavigation) {
    const target = request.nextUrl.clone();
    target.pathname = "/login";
    target.search = "";
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  if (user && loginRoute && pageNavigation) {
    const target = request.nextUrl.clone();
    target.pathname = "/";
    target.search = "";
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
