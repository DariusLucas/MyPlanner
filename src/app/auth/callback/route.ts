import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";

function safeNextPath(value: string | null) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=The+sign-in+link+was+incomplete.", request.url));
  }

  const client = await createSupabaseServerClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    const message = encodeURIComponent("That sign-in link has expired or was already used.");
    return NextResponse.redirect(new URL(`/login?error=${message}`, request.url));
  }

  const { data } = await client.auth.getUser();
  if (data.user) {
    await client.from("app_settings").upsert(
      { user_id: data.user.id, timezone: "Europe/Bucharest" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
