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
};

export default withPWA(nextConfig);