import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpack = require("webpack");

const nextConfig: NextConfig = {
  transpilePackages: ["@satsu/sdk"],
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
