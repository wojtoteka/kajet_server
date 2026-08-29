import type { NextConfig } from "next";

const DEFAULT_MAX_FILE_BYTES = 26_214_400;
const configuredFileBytes = Number(process.env.MAX_FILE_BYTES);
const maxFileBytes =
  Number.isFinite(configuredFileBytes) && configuredFileBytes >= 0
    ? configuredFileBytes
    : DEFAULT_MAX_FILE_BYTES;

const config: NextConfig = {
  reactStrictMode: true,

  // Nginx sits in front of the app and handles compression, so it is not needed here.
  compress: false,

  // A handwritten note with dense writing can weigh several megabytes, while
  // server actions accept only one by default. The library upload uses the
  // same MAX_FILE_BYTES as the API; multipart headers get a small allowance
  // so a file exactly at the limit still reaches our readable validator.
  experimental: {
    serverActions: {
      bodySizeLimit: Math.max(16 * 1024 * 1024, maxFileBytes + 64 * 1024),
    },
  },

  /*
    Stare, polskie adresy. Strona do pobierania i zakładka wydań nazywają się
    teraz po angielsku, jak reszta - a odnośnik do pobierania mógł już gdzieś
    pójść (aplikacja pyta serwer o adres sama, ale człowiek mógł go wkleić).
    Przekierowanie jest stałe, więc kosztuje jedno zapytanie i tyle.
  */
  async redirects() {
    return [
      { source: "/pobierz", destination: "/download", permanent: true },
      { source: "/pobierz/plik", destination: "/download/file", permanent: true },
      { source: "/admin/aplikacja", destination: "/admin/app", permanent: true },
      { source: "/regulamin", destination: "/terms", permanent: true },
      { source: "/polityka-prywatnosci", destination: "/privacy", permanent: true },
    ];
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
