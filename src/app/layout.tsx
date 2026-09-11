import "@fontsource-variable/inter";
import type { Metadata } from "next";
import { AppShell } from "@/src/components/app-shell";
import { ThemeProvider } from "@/src/components/theme-provider";
import { signOut } from "@/src/app/auth-actions";
import { createSupabaseServerClient } from "@/src/lib/supabase/server";
import { getPlannerCategories } from "@/src/lib/supabase/planner";
import { CategoryProvider } from "@/src/components/category-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Planner",
  description: "A private personal progress system.",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const client = await createSupabaseServerClient();
  const { data } = await client.auth.getClaims();
  const userEmail = typeof data?.claims.email === "string" ? data.claims.email : undefined;
  const categories = typeof data?.claims.sub === "string" ? await getPlannerCategories() : [];

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <CategoryProvider categories={categories}>
            <AppShell signOutAction={signOut} userEmail={userEmail}>{children}</AppShell>
          </CategoryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
