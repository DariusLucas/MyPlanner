import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep `next dev` artifacts away from `.next`, which is also used by
    // production builds. This prevents validation builds from corrupting a
    // running dev server's RSC and CSS manifests.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    devIndicators: false,
  };
}
