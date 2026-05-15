import type { NextConfig } from "next";
import path from "node:path";

// The SDK's wasm-loader uses `await import("node:fs/promises")` behind a Node
// env check. Browser bundlers still parse the expression, so it must be aliased
// away. Production builds use webpack (`next build --webpack`) because
// Turbopack's chunk runtime has an open bug that breaks @stacks/connect at
// runtime.
const nextConfig: NextConfig = {
  transpilePackages: ["@satsu/sdk"],
  turbopack: {
    root: path.join(__dirname, "../.."),
    resolveAlias: {
      "node:fs": { browser: "./src/lib/empty-module.ts" },
      "node:fs/promises": { browser: "./src/lib/empty-module.ts" },
    },
  },
  webpack: (config, { isServer, webpack }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "node:fs": "fs",
      "node:fs/promises": "fs/promises",
    };
    if (!isServer) {
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
