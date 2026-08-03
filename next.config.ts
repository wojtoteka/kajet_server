import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,

  // Nginx sits in front of the app and handles compression, so it is not needed here.
  compress: false,

  // A handwritten note with dense writing can weigh several megabytes, while
  // server actions accept only one by default.
  experimental: {
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },

  async headers() {
    return [
      {
        // The tablet app connects from a different origin than the site, so
        // the API has to allow it explicitly.
        source: "/api/v1/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          {
            key: "Access-Control-Allow-Headers",
            value: "Authorization, Content-Type, X-Kajet-Device",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
    ];
  },
};

export default config;
