import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.FINARA_NEXT_DIST_DIR ? { distDir: process.env.FINARA_NEXT_DIST_DIR } : {}),
};

export default nextConfig;
