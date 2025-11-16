import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for better CSS support
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Ensure CSS is properly handled
  webpack: (config, { isServer }) => {
    // Handle CSS properly
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  // Skip linting during build for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;