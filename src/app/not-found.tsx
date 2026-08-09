import Link from "next/link";
import { cookies } from "next/headers";
import { currentLanguage, currentWords } from "@/lib/language";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import home from "./home.module.css";
import styles from "./not-found.module.css";

/*
  Strona pod nieznanym adresem. Bez tego pliku Next.js pokazuje swoją własną -
  białą kartkę z napisem „This page could not be found." po angielsku, bez
  śladu Kajetu i bez żadnego wyjścia dalej.

  Ta mówi językiem strony tytułowej, nie panelu: nagłówek ze znakiem,
  podkreślone słowo i gruba zielona kreska. Kreska tym razem pisze „404"
  i przy ostatniej cyfrze schodzi w zawijas - szukała strony, nie znalazła.
  Obok tekst w tym samym duchu: może literówka, może przeniesiona strona,
  a może pies zjadł kartkę, jak kiedyś zadanie domowe.

  Nie dotyczy adresów /api - te mają własną odpowiedź w JSON, bo czyta je
  aplikacja, a nie człowiek (src/app/api/[...sciezka]/route.ts).
*/

export async function generateMetadata() {
  return { title: (await currentWords()).metaPageNotFound };
}

export default async function NotFound() {
  const words = await currentWords();
  const language = await currentLanguage();

  /*
    Nagłówek wybiera tylko między „Moje notatki" a „Zaloguj się", więc zamiast
    pełnego auth() wystarczy spojrzeć, czy ciasteczko sesji w ogóle jest.
    Pełne auth() robi zapytanie do bazy przy każdym wywołaniu (callback jwt),
    a na 404 trafia każdy zbłąkany bot - i wykonuje się przy prerenderze
    /_not-found podczas builda, gdzie bazy może nie być. Przeterminowane
    ciasteczko najwyżej pokaże „Moje notatki" komuś wylogowanemu - biblioteka
    i tak sprawdza sesję naprawdę.
  */
  const jar = await cookies();
  const signedIn = Boolean(
    jar.get("__Secure-authjs.session-token") ?? jar.get("authjs.session-token"),
  );

  /*
    Podkreślone jest ostatnie słowo tytułu, jak na stronie kontaktu -
    w obu językach stoi tam to, czego brakuje: „Nie ma takiej STRONY",
    „No such PAGE" - więc działa bez osobnych kluczy w słowniku.
  */
  const heading = words.pageNotFoundHeading;
  const cut = heading.lastIndexOf(" ");
  const before = cut > 0 ? heading.slice(0, cut + 1) : "";
  const underlined = cut > 0 ? heading.slice(cut + 1) : heading;

  return (
    <div className={home.strona}>
      <header className={`${home.rzad} ${home.naglowek}`}>
        <Link className={home.znak} href="/">
          <svg viewBox="0 0 96 96" width={32} height={32} aria-hidden="true" focusable="false">
            <g
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 10 H66 L80 24 V86 H16 Z" />
              <path d="M36 10 V86" />
            </g>
            <path
              d="M22 62 C34 56, 44 44, 74 38"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
          Kajet
        </Link>

        <div className={home.naglowekPrawa}>
          <LanguageSwitch current={language} />
          <ThemeSwitch />
          {signedIn ? (
            <Link className={home.cichy} href="/library">
              {words.myNotes}
            </Link>
          ) : (
            <Link className={home.cichy} href="/signin">
              {words.signIn}
            </Link>
          )}
        </div>
      </header>

      <main>
        <section className={`${home.rzad} ${styles.otwarcie}`}>
          <div className={styles.opowiesc}>
            <p className={home.nadtytul}>{words.error404}</p>
            <h1>
              {before}
              <span className={home.podkreslone}>
                {underlined}
                <svg
                  viewBox="0 0 240 44"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path
                    d="M4 26 C 58 13, 134 9, 208 15 L 236 19 C 237 25, 232 30, 223 31 C 149 23, 76 27, 15 39 C 8 37, 3 32, 4 26 Z"
                    fill="var(--accent)"
                  />
                </svg>
              </span>
            </h1>
            <p className={home.zajawka}>{words.pageNotFoundLead}</p>

            <div className={home.przyciski}>
              {signedIn ? (
                <>
                  <Link className={`${home.przycisk} ${home.pelny}`} href="/library">
                    {words.myNotes}
                  </Link>
                  <Link className={home.przycisk} href="/">
                    {words.homePage}
                  </Link>
                </>
              ) : (
                <>
                  <Link className={`${home.przycisk} ${home.pelny}`} href="/">
                    {words.homePage}
                  </Link>
                  <Link className={home.przycisk} href="/signin">
                    {words.signIn}
                  </Link>
                </>
              )}
            </div>

            <p className={home.drobne}>
              {words.sharedLinkNote} {words.pageNotFoundWrite}{" "}
              <Link className={home.zwyklyOdnosnik} href="/contact">
                {words.pageNotFoundWriteLink}
              </Link>
              .
            </p>
          </div>

          {/* Pióro pisze „404" jedną ciągłą linią, bez odrywania: czwórka
              domknięta w trójkąt, z jej laski zjazd w pętlę zera, spod zera
              wzbicie w ukos ostatniej czwórki, kreska w poprzek, powrót po
              laseczce i zjazd w coraz ciaśniejszy zawijas - pióro szukało
              i się poddało. Powtórzone przejazdy (ukos, laseczka) celowo
              nakładają się na siebie: przy tej grubości zlewają się w jedno,
              a w animacji wyglądają jak naturalne poprawianie kreski.
              Rysunek jest ozdobą: „404" stoi tekstem w nadtytule. */}
          <div className={styles.rysunek} aria-hidden="true">
            <svg viewBox="0 0 560 400" fill="none" focusable="false">
              <path
                className={styles.kreska}
                pathLength={1}
                d={
                  "M 140 60 " +
                  "C 108 102, 78 152, 54 194 C 94 202, 138 200, 178 190 " +
                  "C 168 146, 154 100, 142 64 C 146 130, 142 200, 136 264 " +
                  "C 148 290, 178 288, 208 272 C 246 282, 296 276, 322 232 " +
                  "C 344 196, 342 128, 310 96 C 284 74, 232 72, 208 102 " +
                  "C 186 130, 184 190, 204 228 C 212 244, 224 252, 238 254 " +
                  "C 270 272, 306 268, 336 236 C 380 184, 428 112, 452 60 " +
                  "C 428 104, 404 150, 378 192 C 412 198, 450 196, 482 188 " +
                  "C 474 150, 468 114, 464 84 C 468 148, 462 212, 456 262 " +
                  "C 450 308, 420 332, 382 336 C 352 339, 332 324, 336 302 " +
                  "C 340 282, 364 278, 374 292 C 381 302, 374 314, 361 314"
                }
                stroke="var(--accent)"
                strokeWidth="30"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.92"
              />
              <g
                className={styles.pytajnik}
                stroke="currentColor"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
              >
                <path d="M 500 252 C 497 234, 513 222, 529 227 C 547 233, 550 255, 534 266 C 526 272, 523 278, 523 287" />
                <path d="M 523 306 L 523 307" />
              </g>
            </svg>
          </div>
        </section>
      </main>
    </div>
  );
}
