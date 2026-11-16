import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright ships native binaries and must not be bundled by Next.js.
  serverExternalPackages: ["playwright", "playwright-core"],
};

export default nextConfig;
