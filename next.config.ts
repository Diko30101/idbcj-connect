import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Existing settings
  experimental: {
    ppr: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 2. NEW: Allow images from the hosting site i.ibb.co
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
      },
    ],
  },
};

export default nextConfig;