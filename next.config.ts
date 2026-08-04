import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Silence multi-lockfile root inference when a parent monorepo lockfile exists
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
