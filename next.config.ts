import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    // Grabs the first 7 characters of the Vercel commit hash, or defaults to dev-local
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev-local',
    // Stamps the exact time the build was compiled
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  }
};

// Export standard config without the PWA wrapper
export default nextConfig;