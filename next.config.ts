import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "archiver", "extract-zip"],
};

export default nextConfig;
