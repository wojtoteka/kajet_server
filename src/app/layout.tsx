import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kajet",
  description:
    "Notatnik na tablet i na komputer. Pismo odręczne, notatki tekstowe, mapy myśli i kod, wszystko w jednym miejscu.",
  applicationName: "Kajet",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Browser bar colour on a phone. The same as the desk background.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e7e2d6" },
    { media: "(prefers-color-scheme: dark)", color: "#171614" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
