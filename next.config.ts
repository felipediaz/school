import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["fabric", "ssh2-sftp-client", "pdf-lib"],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
