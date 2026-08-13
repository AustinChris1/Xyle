import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /**
   * The /docs pages read markdown off disk at request time. Next only traces
   * files it can see being imported, so the folder has to be declared or the
   * docs render empty in production while working fine locally.
   *
   * Keys are picomatch globs over the route path, so "/docs/*" is used rather
   * than "/docs/[slug]" — the brackets would otherwise parse as a character
   * class and match /docs/s, /docs/l, and nothing real.
   */
  outputFileTracingIncludes: {
    "/docs": ["./docs/**/*.md"],
    "/docs/*": ["./docs/**/*.md"],
  },
  // Silence multi-lockfile root inference when a parent monorepo lockfile exists
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
