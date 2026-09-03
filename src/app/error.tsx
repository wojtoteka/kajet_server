"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWords } from "@/components/LanguageProvider";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import home from "./home.module.css";
import styles from "./error.module.css";

/*
  Granica błędu dla całej strony. Bez tego pliku Next.js pokazuje swoją własną:
  białą kartkę z napisem „Application error: a client-side exception has
  occurred" - po angielsku, bez śladu Kajetu i bez wyjścia dalej.

  Wpada tu każdy błąd, którego strona nie obsłużyła sama. Najczęstszy przypadek
  jest przy tym całkiem zwyczajny: ktoś ma otwartą kartę od wczoraj, w
  międzyczasie poszło wdrożenie, a serwer nie zna już wywołań z tamtej wersji
  strony. Zapis notatki tędy NIE idzie - łapie go safe-action.ts, żeby treść
  została na ekranie - ale wszystko poza nim dostaje tę stronę zamiast białej
  kartki.

  „Spróbuj jeszcze raz" (reset) każe Reactowi narysować gałąź od nowa. Gdy
  strona jest starsza niż serwer, samo to nie wystarczy - dlatego obok stoi
  wyjście na stronę tytułową, które wchodzi na serwer po świeżą wersję.
*/

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const words = useWords();

  // Do konsoli przeglądarki - w logu serwera stoi już `digest` tego samego
  // błędu, więc jest po czym zestawić jedno z drugim.
  useEffect(() => {
    console.error(error);
  }, [error]);

  /*
    Podkreślone jest ostatnie słowo nagłówka, jak na 404 i na stronie kontaktu.
    W obu językach pada tam to, co się wydarzyło („Coś się POPSUŁO", „Something
    went WRONG"), więc działa bez osobnych kluczy w słowniku.
  */
  const heading = words.errorHeading;
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
          <ThemeSwitch />
        </div>
      </header>

      <main>
        <section className={`${home.rzad} ${styles.otwarcie}`}>
          <p className={home.nadtytul}>{words.errorWord}</p>
          <h1>
            {before}
            <span className={home.podkreslone}>
              {underlined}
              <svg viewBox="0 0 240 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path
                  d="M4 26 C 58 13, 134 9, 208 15 L 236 19 C 237 25, 232 30, 223 31 C 149 23, 76 27, 15 39 C 8 37, 3 32, 4 26 Z"
                  fill="var(--accent)"
                />
              </svg>
            </span>
          </h1>
          <p className={home.zajawka}>{words.errorLead}</p>

          <div className={home.przyciski}>
            <button type="button" className={`${home.przycisk} ${home.pelny}`} onClick={reset}>
              {words.errorTryAgain}
            </button>
            <Link className={home.przycisk} href="/">
              {words.homePage}
            </Link>
          </div>

          <p className={home.drobne}>
            {words.errorWriteUs}{" "}
            <Link className={home.zwyklyOdnosnik} href="/contact">
              {words.pageNotFoundWriteLink}
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
