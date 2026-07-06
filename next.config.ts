import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  env: {
    NEXT_PUBLIC_CONVEX_URL: "https://focused-bear-745.convex.cloud",
    NEXT_PUBLIC_CONVEX_SITE_URL: "https://focused-bear-745.convex.site",
    CONVEX_SITE_URL: "https://focused-bear-745.convex.site",
    SITE_URL: "https://leave-management.hssong1107.workers.dev",
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
