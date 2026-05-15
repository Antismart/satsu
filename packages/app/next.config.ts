import type { NextConfig } from "next";
import path from "node:path";

// The SDK's wasm-loader uses `await import("node:fs/promises")` behind a Node
// env check. Browser bundlers still parse the expression, so it must be aliased
// away. Turbopack is the default in Next 16; the webpack block only fires under
// `next build --webpack`.
const nextConfig: NextConfig = {
  transpilePackages: ["@satsu/sdk"],
  turbopack: {
    root: path.join(__dirname, "../.."),
    resolveAlias: {
      "node:fs": { browser: "./src/lib/empty-module.ts" },
      "node:fs/promises": { browser: "./src/lib/empty-module.ts" },
    },
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "node:fs": "fs",
      "node:fs/promises": "fs/promises",
    };
    if (!config.isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        "fs/promises": false,
      };
    }
    return config;
  },
};

export default nextConfig;
