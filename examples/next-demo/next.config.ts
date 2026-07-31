import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@ctrlc/react",
    "@ctrlc/core",
    "@ctrlc/next",
  ],
  reactStrictMode: true,
};

export default nextConfig;
