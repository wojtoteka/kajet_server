import Link from "next/link";
import { auth } from "@/lib/auth";
import { contactWorks, hcaptchaWorks, settings } from "@/lib/settings";
import { currentLanguage, currentWords } from "@/lib/language";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ContactForm } from "./ContactForm";
import home from "../home.module.css";
import styles from "./contact.module.css";

export async function generateMetadata() {
  return { title: (await currentWords()).metaContact };
}

/*
  Strona kontaktu mówi językiem strony tytułowej, nie panelu: ten sam
  nagłówek ze znakiem, podkreślone słowo w tytule i zielona kreska.
  Wspólne style idą z home.module.css, własne z contact.module.css.
*/

export default async function ContactPage() {
  const words = await currentWords();
  const language = await currentLanguage();
  const session = await auth();
  const signedIn = Boolean(session?.user?.id);
  const email = settings.contact.email;

  /*
    Podkreślone jest ostatnie słowo tytułu - tak jak słowo „Kajet" na stronie
    tytułowej. Ostatnie, bo w obu językach tam stoi adresat: „Napisz do NAS",
    „Write to US" - i to działa bez osobnych kluczy w słowniku.
  */
  const heading = words.contactHeading;
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
            <p className={home.nadtytul}>{words.contactEyebrow}</p>
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
            <p className={home.zajawka}>{words.contactLead}</p>
            <p className={home.drobne}>
              {words.contactMailInstead}{" "}
              <a className={home.zwyklyOdnosnik} href={`mailto:${email}`}>
                {email}
              </a>
              .
            </p>

            {/* Papierowy samolocik: wiadomość w drodze. Kreska lotu kreśli się
                przy wczytaniu, w połowie zapętla w koło z ogonkiem jak pisane Q,
                a samolocik dolatuje na koniec. */}
            <div className={styles.samolot} aria-hidden="true">
              <svg viewBox="0 0 520 240" fill="none" focusable="false">
                <path
                  className={styles.lot}
                  pathLength={1}
                  d={
                    "M 14 204 C 66 197, 114 194, 156 186 C 200 180, 237 147, 262 130 " +
                    "C 277 120, 286 102, 286 84 C 286 53, 261 28, 230 28 " +
                    "C 199 28, 174 53, 174 84 C 174 115, 199 140, 230 140 " +
                    "C 236 140, 243 139, 249 137 C 262 147, 274 158, 290 167 " +
                    "C 320 182, 356 180, 388 162 C 396 154, 400 146, 406 138"
                  }
                  stroke="var(--accent)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                <g
                  className={styles.maszyna}
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                >
                  <path d="M 500 70 L 432 118 L 466 124 Z" />
                  <path d="M 500 70 L 466 124 L 472 144 L 481 126" />
                </g>
              </svg>
            </div>
          </div>

          <div className={styles.arkusz}>
            {contactWorks() ? (
              <ContactForm
                apiUrl={settings.contact.apiUrl}
                apiKey={settings.contact.apiKey}
                captchaSiteKey={hcaptchaWorks() ? settings.contact.hcaptchaSiteKey : ""}
                language={language}
              />
            ) : (
              <p className="error" style={{ margin: 0 }}>
                {words.contactNotSet}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
