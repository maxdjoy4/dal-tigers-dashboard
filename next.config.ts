import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  experimental: {
    workerThreads: true,
    webpackBuildWorker: false,
  },
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
