import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DESK_DARK, DESK_LIGHT, THEME_BOOT_SCRIPT } from "@/lib/theme";
import { currentLanguage, currentWords } from "@/lib/language";
import { LanguageProvider } from "@/components/LanguageProvider";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Kajet",
    description: (await currentWords()).siteDescription,
    applicationName: "Kajet",
  };
  // The favicon comes from src/app/icon.svg (a file convention), so it is
  // bundled with the build instead of depending on the public directory.
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Browser bar colour on a phone. The same as the desk background. Przy
  // ręcznie wybranym motywie barwę tych znaczników poprawia applyTheme.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: DESK_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: DESK_DARK },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Znacznik języka czyta czytnik ekranu i przeglądarka (podpowiedzi
  // tłumaczenia, dzielenie wyrazów), więc idzie za wyborem człowieka.
  const language = await currentLanguage();

  return (
    <html lang={language}>
      <head>
        {/*
          Zapisany wybór motywu stawiamy przed pierwszym rysowaniem strony -
          inaczej mrugnęłaby motywem systemu, zanim React zdąży cokolwiek
          zrobić. Skrypt jest krótki i nie ściąga niczego z sieci.
        */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/*
          Pismo strony. Do tej pory arkusz prosił o Archivo i IBM Plex, ale nikt
          ich nie wczytywał, więc wszystko lądowało na zapasowym Segoe UI.
        */}
        <link
          rel="stylesheet"
          href={
            "https://fonts.googleapis.com/css2" +
            "?family=Archivo:wght@400;500;600;700" +
            "&family=IBM+Plex+Sans:wght@400;500;600" +
            "&family=IBM+Plex+Mono:wght@400;500" +
            "&display=swap"
          }
        />
        {/*
          Ikony: Material Symbols z fonts.google.com/icons. display=block, żeby
          zanim pismo dojedzie, nie mrugnąć nazwą ikony zapisaną słowem.
        */}
        <link
          rel="stylesheet"
          href={
            "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:" +
            "opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
          }
        />
      </head>
      {/* Edytory są klienckie i nie dosięgną ciasteczek serwera - język,
          który serwer już zna, podajemy im tędy. */}
      <body>
        <LanguageProvider language={language}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
