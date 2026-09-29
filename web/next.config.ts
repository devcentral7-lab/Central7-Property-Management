import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/properties/[ref]/pdf": ["./public/logo.jpg"],
  },
};

export default nextConfig;
