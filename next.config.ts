import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.230.148.101"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
