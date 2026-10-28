import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config, { isServer }) {
    if (!isServer) {
      // canvas-record ships an optional wasm H.264 encoder whose Node build references fs/path.
      // We export with WebCodecs in the browser, so stub them for the client bundle.
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false };
    }
    return config;
  },
};

export default nextConfig;
