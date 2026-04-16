import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development", // Keeps it turned off while you are coding locally
  workboxOptions: {
    skipWaiting: true,   // Forces the new service worker to activate immediately
    clientsClaim: true,  // Takes control of all open tabs/windows immediately
  },
});

const nextConfig: NextConfig = {
  turbopack: {},
  env: {
    // Grabs the first 7 characters of the Vercel commit hash, or defaults to dev-local
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev-local',
    // Stamps the exact time the build was compiled
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  }
};

export default withPWA(nextConfig);