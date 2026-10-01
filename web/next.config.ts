import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Photo uploads go one file per request; Vercel rejects bodies over 4.5 MB.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  outputFileTracingIncludes: {
    "/api/properties/[ref]/pdf": [
      "./public/logo-light.png",
      // pdfkit loads its built-in fonts via createRequire("#standard-fonts/…"),
      // which resolves to the .cjs files that the tracer doesn't follow.
      "./node_modules/pdfkit/js/standard-fonts/**/*",
    ],
  },
};

export default nextConfig;
