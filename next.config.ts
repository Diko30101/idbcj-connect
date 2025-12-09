import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Existing settings
  experimental: {
    ppr: false,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 2. Allow images from hosting sites
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.ibb.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}; // <--- THIS WAS MISSING!

export default nextConfig;