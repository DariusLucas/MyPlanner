import "@fontsource-variable/inter";
import type { Metadata } from "next";
import { AppShell } from "@/src/components/app-shell";
import { ThemeProvider } from "@/src/components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "My Planner",
  description: "A local-first personal progress system.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AppShell>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
