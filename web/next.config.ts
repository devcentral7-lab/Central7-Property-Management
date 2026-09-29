import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/properties/[ref]/pdf": [
      "./public/logo.jpg",
      // pdfkit loads its built-in fonts via createRequire("#standard-fonts/…"),
      // which resolves to the .cjs files that the tracer doesn't follow.
      "./node_modules/pdfkit/js/standard-fonts/**/*",
    ],
  },
};

export default nextConfig;
