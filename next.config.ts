import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Must cover the largest single file any upload Server Action accepts — 15MB
      // employee/candidate documents (resumes and attachments are 10MB) — plus the
      // multipart overhead around it. Per-feature limits are enforced by each validator.
      bodySizeLimit: "16mb",
    },
  },
  // Apply on all hosts (ECS/ALB), not only Vercel.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // File previews are shown in an iframe on our own pages, so let only
      // this site frame them. Later rules override the DENY above.
      ...[
        "/api/recruitment/documents/preview",
        "/api/recruitment/communications/attachments/preview",
      ].map((source) => ({
        source,
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      })),
    ];
  },
  // Keep Prisma/pg out of the server bundle so native query engines resolve at runtime.
  serverExternalPackages: [
    "@prisma/client",
    "prisma",
    "pg",
    "@prisma/adapter-pg",
    "@aws-sdk/client-s3",
  ],
  // Custom Prisma output is gitignored; file tracing must explicitly ship engines to /var/task.
  outputFileTracingIncludes: {
    "/**/*": ["./src/generated/prisma/**/*"],
  },
  webpack(config) {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });
    return config;
  },
};

export default nextConfig;
