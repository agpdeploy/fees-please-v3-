import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development", // Keeps it turned off while you are coding locally so it doesn't cache your mistakes
});

const nextConfig: NextConfig = {
  /* Your existing config options (if any) go here */
};

export default withPWA(nextConfig);