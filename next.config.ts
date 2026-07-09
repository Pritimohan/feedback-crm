import path from "node:path";
import type { NextConfig } from "next";

/** Parent `office/` may have a stray lockfile; pin app root so `tailwindcss` resolves from feedbackCRM/node_modules. */
const projectRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
