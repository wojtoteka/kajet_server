import type { Metadata, Viewport } from "next";
import { Archivo, Bricolage_Grotesque, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { DESK_DARK, DESK_LIGHT, THEME_BOOT_SCRIPT } from "@/lib/theme";
import { currentLanguage, currentWords } from "@/lib/language";
import { LanguageProvider } from "@/components/LanguageProvider";
import { SiteFooter } from "@/components/SiteFooter";

/*
  Pisma tekstowe strony. next/font ściąga je raz, przy budowaniu, i serwuje
  z naszego serwera - przeglądarka nie czeka już na arkusz z serwera Google,
  zanim cokolwiek narysuje. Każde pismo trafia do zmiennej CSS, po którą
  sięga globals.css (--font-heading, --font-body, --font-mono).

  latin-ext to polskie znaki. Archivo i Bricolage są pismami zmiennymi,
  więc nie wymieniamy grubości; Plex istnieje tylko w stałych odmianach.
*/
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  variable: "--font-archivo",
  display: "swap",
});
const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  variable: "--font-bricolage",
  display: "swap",
});
const plexSans = IBM_Plex_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

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
    <html
      lang={language}
      className={`${archivo.variable} ${bricolage.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <head>
        {/*
          Zapisany wybór motywu stawiamy przed pierwszym rysowaniem strony -
          inaczej mrugnęłaby motywem systemu, zanim React zdąży cokolwiek
          zrobić. Skrypt jest krótki i nie ściąga niczego z sieci.

          `data-cfasync="false"` to prośba do Cloudflare'a, żeby trzymał się od
          tego skryptu z daleka. Rocket Loader podmienia `type` każdemu
          skryptowi na stronie i uruchamia je dopiero po przeczytaniu całego
          dokumentu - a wtedy nie ma już czego ratować: na krótkiej stronie
          nikt tego nie widzi, ale regulamin i polityka prywatności to
          kilkadziesiąt ekranów tekstu i przez ten czas świeci motyw systemu.
        */}
        <script data-cfasync="false" dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {/*
          Żadnych zapytań do Google: pisma tekstowe niesie next/font (wyżej),
          a pismo ikon leży w repo i wczytuje je globals.css (@font-face przy
          klasie .ms). Oba są przycięte do tego, czego strona używa.
        */}
      </head>
      {/* Edytory są klienckie i nie dosięgną ciasteczek serwera - język,
          który serwer już zna, podajemy im tędy. */}
      <body>
        <LanguageProvider language={language}>
          {/* Treść strony w osobnym pudełku, żeby mogła urosnąć do wysokości
              okna - inaczej na krótkiej stronie stopka wisiałaby w połowie
              ekranu zamiast siedzieć na samym dole. */}
          <div className="site-main">{children}</div>
          <SiteFooter />
        </LanguageProvider>
      </body>
    </html>
  );
}
