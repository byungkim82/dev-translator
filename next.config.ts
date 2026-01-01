import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // OpenNext requires these settings for Cloudflare Workers
  output: "standalone",
};

export default nextConfig;
