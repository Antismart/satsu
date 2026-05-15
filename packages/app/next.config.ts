import type { NextConfig } from "next";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpack = require("webpack");

// The SDK's wasm-loader uses `await import("node:fs/promises")` behind a Node
// env check. Browser bundlers still parse the expression, so it must be aliased
// away. Turbopack and webpack each need their own opt-in.
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
      config.plugins = [
        ...(config.plugins || []),
        new webpack.IgnorePlugin({ resourceRegExp: /^node:fs(\/promises)?$/ }),
      ];
    }
    return config;
  },
};

export default nextConfig;
