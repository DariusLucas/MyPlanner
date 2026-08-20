import "@fontsource-variable/inter";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@/src/components/theme-provider";
import "@/src/app/globals.css";
import "./mobile.css";
import { MobileApp } from "./mobile-app";
import { MobileRouterProvider } from "./router";

const root = document.getElementById("root");
if (!root) throw new Error("MyPlanner could not find its app root.");

createRoot(root).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <MobileRouterProvider>
        <MobileApp />
      </MobileRouterProvider>
    </ThemeProvider>
  </StrictMode>,
);
