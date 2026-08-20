import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const mobile = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: mobile,
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "next/link",
        replacement: fileURLToPath(new URL("./src/next-link.tsx", import.meta.url)),
      },
      {
        find: "next/navigation",
        replacement: fileURLToPath(new URL("./src/next-navigation.ts", import.meta.url)),
      },
      {
        find: "@/src/app/today/actions",
        replacement: fileURLToPath(new URL("./src/actions/tasks.ts", import.meta.url)),
      },
      {
        find: "@/src/app/dashboard-actions",
        replacement: fileURLToPath(new URL("./src/actions/thoughts.ts", import.meta.url)),
      },
      {
        find: "@/src/app/content-actions",
        replacement: fileURLToPath(new URL("./src/actions/milestones.ts", import.meta.url)),
      },
      { find: "@", replacement: root },
    ],
  },
  build: {
    outDir: fileURLToPath(new URL("../dist-mobile", import.meta.url)),
    emptyOutDir: true,
    target: "es2022",
  },
});
