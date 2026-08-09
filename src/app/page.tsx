import Link from "next/link";
import { auth } from "@/lib/auth";
import { currentRelease } from "@/lib/app-release";
import { humanSize } from "@/lib/quota";
import { currentLanguage, currentWords } from "@/lib/language";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import styles from "./home.module.css";

/*
  Strona tytułowa.

  Jedna opowieść od góry do dołu: co to jest, cztery rodzaje notatek, wybór
  między katalogiem a kontem, udostępnianie i pobranie aplikacji. Prowadzi ją
  gruba kreska zielonego atramentu (cztery rysunki SVG, które czytają się jak
  jeden gest pisania). Style siedzą w home.module.css, żeby nie mieszać się
  z arkuszem panelu - wspólne są tylko barwy z globals.css i oba przełączniki
  w nagłówku.

  Wszystkie stwierdzenia na tej stronie mają pokrycie w kodzie: lista języków
  w lib/code-runner.ts, wymagania aplikacji w jej build.gradle.kts (minSdk 26,
  arm64), zasady udostępniania w lib/sharing.ts.
*/

export default async function HomePage() {
  const session = await auth();
  const release = await currentRelease();
  const words = await currentWords();
  const language = await currentLanguage();
  const signedIn = Boolean(session?.user?.id);

  return (
    <div className={styles.strona}>
      <a className={styles.przeskok} href="#tresc">
        {words.skipToContent}
      </a>

      <header className={`${styles.rzad} ${styles.naglowek}`}>
        <Link className={styles.znak} href="/">
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

        <div className={styles.naglowekPrawa}>
          <LanguageSwitch current={language} />
          <ThemeSwitch />
          {signedIn ? (
            <Link className={styles.cichy} href="/library">
              {words.myNotes}
            </Link>
          ) : (
            <Link className={styles.cichy} href="/signin">
              {words.signIn}
            </Link>
          )}
        </div>
      </header>

      <main id="tresc">
        <section className={`${styles.rzad} ${styles.otwarcie}`}>
          <div>
            <p className={styles.nadtytul}>{words.homeEyebrow}</p>
            <h1>
              {words.homeTitleBefore}
              <span className={styles.podkreslone}>
                {words.homeTitleWord}
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
              {words.homeTitleAfter}
            </h1>
            <p className={styles.zajawka}>{words.homeLead}</p>

            <div className={styles.przyciski}>
              {signedIn ? (
                <Link className={`${styles.przycisk} ${styles.pelny}`} href="/library">
                  {words.myNotes}
                </Link>
              ) : (
                <>
                  <Link className={`${styles.przycisk} ${styles.pelny}`} href="/signin">
                    {words.signIn}
                  </Link>
                  <Link className={styles.przycisk} href="/register">
                    {words.haveInviteCode}
                  </Link>
                </>
              )}
              {release ? (
                <Link className={styles.zwyklyOdnosnik} href="/download">
                  {words.downloadForAndroid}
                </Link>
              ) : null}
            </div>

            {release ? (
              <p className={styles.drobne}>
                {words.latestRelease}: {release.version}, {humanSize(release.sizeBytes)}.
              </p>
            ) : null}
          </div>

          {/* Pierwsze wystąpienie kreski: wpada spoza górnej krawędzi i nurkuje
              w stronę nagłówka. Drugie to podkreślenie w h1. */}
          <div className={styles.gest} aria-hidden="true">
            <svg viewBox="0 0 420 660" fill="none" focusable="false">
              <path
                className={styles.gestKreska}
                d="M352 -40 C 378 92, 341 178, 274 241 C 213 298, 149 338, 137 413 C 127 480, 176 515, 233 502 C 262 495, 281 474, 276 449"
                stroke="var(--accent)"
                strokeWidth="34"
                strokeLinecap="round"
                pathLength={1}
                opacity="0.92"
              />
            </svg>
          </div>
        </section>

        <section className={`${styles.rzad} ${styles.rodzaje}`}>
          <h2>{words.homeKindsTitle}</h2>
          <p className={styles.wstep}>{words.homeKindsIntro}</p>

          <div className={styles.pasmoPismo}>
            <div>
              <h3>{words.homeKindHandTitle}</h3>
              <p>{words.homeKindHandBody}</p>
            </div>
            {/*
              Domek: dwie kartki papieru jedna na drugiej i rysunek, który nie
              mieści się na wierzchniej - szczyt dachu z kominem wychodzi górą,
              ziemia prawą krawędzią. Prowadzenie kreski jest celowo krzywe
              (żadna linia nie jest prosta, rogi się mijają), ale sam atrament
              to ten sam co wszędzie: 3,2 na obrysie, cieniej na oknach i dymie.
            */}
            <figure>
              <svg viewBox="0 36 460 348" role="img" aria-label={words.homeHandPicture}>
                <path d="M94 178 L341 169 L347 372 L88 378 Z" fill="var(--sheet)" />
                <path d="M126 150 L369 140 L375 338 L120 346 Z" fill="var(--sheet)" />
                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                >
                  <path d="M104 192 C 100 250, 101 310, 104 363 C 172 370, 258 370, 330 363" />
                  <path d="M148 217 C 180 191, 214 161, 246 132 C 280 160, 314 190, 346 215" />
                  <path d="M172 206 C 170 240, 170 272, 173 303 C 220 307, 282 307, 326 302 C 328 270, 328 238, 326 206" />
                  <path d="M286 163 C 285 148, 285 136, 286 126 C 296 122, 306 122, 314 126 C 315 148, 315 170, 316 190" />
                  <path d="M230 303 C 229 280, 229 258, 231 238 C 242 234, 258 234, 268 238 C 270 260, 270 282, 269 303" />
                  <path
                    d="M186 236 C 196 233, 208 233, 216 236 C 218 244, 218 256, 216 265 C 206 268, 194 268, 186 265 C 184 256, 184 244, 186 236 Z"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M288 236 C 298 233, 310 233, 318 236 C 320 244, 320 256, 318 265 C 308 268, 296 268, 288 265 C 286 256, 286 244, 288 236 Z"
                    strokeWidth="2.5"
                  />
                  <path d="M201 234 C 202 244, 202 256, 201 267" strokeWidth="2" />
                  <path d="M185 250 C 194 249, 208 249, 217 250" strokeWidth="2" />
                  <path d="M303 234 C 304 244, 304 256, 303 267" strokeWidth="2" />
                  <path d="M287 250 C 296 249, 310 249, 319 250" strokeWidth="2" />
                  <path d="M300 112 C 291 94, 311 85, 304 68 C 300 57, 313 50, 324 55" strokeWidth="2" />
                  <path
                    d="M150 320 C 210 315, 300 315, 356 318 C 380 319, 396 318, 406 314"
                    strokeWidth="2.5"
                  />
                </g>
                <circle cx="262" cy="272" r="3" fill="currentColor" opacity="0.85" />
              </svg>
            </figure>
          </div>

          <div className={styles.pasmoTekst}>
            <div>
              <h3>{words.homeKindTextTitle}</h3>
              <p>{words.homeKindTextBody}</p>
            </div>
            {/* Trzy linijki pisma stały wcześniej przy piśmie odręcznym. Tutaj
                znaczą dokładnie to, co pokazują: linijki tekstu. */}
            <figure>
              <svg viewBox="0 0 560 210" role="img" aria-label={words.homeTextPicture}>
                <g
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                >
                  <path d="M24 56 c 8 -18 14 12 24 -4 c 8 -12 12 8 22 2 c 8 -5 10 -14 20 -8 m 18 4 c 10 -14 18 6 30 -6 c 8 -8 16 4 26 0 m 20 2 c 6 -16 16 2 26 -8 c 8 -8 14 10 24 4 c 10 -6 12 -12 22 -6 c 8 5 16 -2 24 -8" />
                  <path d="M24 108 c 12 -14 18 8 30 -2 c 10 -8 14 6 26 0 m 20 0 c 8 -16 18 4 28 -6 c 10 -9 16 8 28 2 c 10 -5 14 -12 24 -4 m 20 0 c 8 -12 20 4 32 -4 c 10 -7 18 6 28 0" />
                  <path d="M24 160 c 10 -12 16 8 28 0 c 10 -7 16 5 26 -1 m 22 0 c 8 -14 18 4 30 -4 c 10 -7 18 8 30 2" />
                  <path d="M186 176 c 34 -8 74 -10 116 -4" strokeWidth="5" opacity="0.9" />
                </g>
              </svg>
            </figure>
          </div>

          <div className={styles.pasmoMapa}>
            <svg viewBox="0 0 320 210" fill="none" aria-hidden="true" focusable="false">
              <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.85">
                <path d="M112 100 C 148 82, 172 68, 212 58" />
                <path d="M110 112 C 150 130, 176 144, 214 152" />
                <path d="M52 86 C 54 70, 76 62, 94 68 C 112 74, 118 94, 108 108 C 98 121, 70 121, 58 108 C 51 100, 50 93, 52 86 Z" />
                <path d="M212 44 C 214 34, 230 30, 242 34 C 254 39, 258 52, 250 60 C 242 68, 222 67, 214 58 C 210 53, 210 49, 212 44 Z" />
                <path d="M214 140 C 216 130, 232 126, 244 130 C 256 135, 260 148, 252 156 C 244 164, 224 163, 216 154 C 212 149, 212 145, 214 140 Z" />
              </g>
            </svg>
            <div>
              <h3>{words.homeKindMapTitle}</h3>
              <p>{words.homeKindMapBody}</p>
            </div>
          </div>

          <div className={styles.pasmoKod}>
            <div>
              <h3>{words.homeKindCodeTitle}</h3>
              <p>{words.homeKindCodeBody}</p>
            </div>
            {/*
              Kartka z kodem leży krzywo, tak jak domek wyżej, ale to, co na
              niej stoi, jest już maszynowe: prawdziwa linijka Pythona i to,
              co wypisała. Znaki zachęty konsoli tłumaczą drugą linijkę same,
              więc nie ma tu żadnego podpisu do przetłumaczenia.

              role="img" z podpisem, bo czytnik ekranu przeczytałby „większy
              większy większy print cudzysłów..." zamiast rzeczy, o którą chodzi.
            */}
            <figure className={styles.wkladka} role="img" aria-label={words.homeCodePicture}>
              <div>
                <span className={styles.znacznikKodu}>Python</span>
                <pre className={styles.kod}>
                  <span className={styles.zacheta}>&gt;&gt;&gt; </span>print(
                  <span className={styles.napis}>&quot;Hello World&quot;</span>){"\n"}
                  <span className={styles.wyjscie}>Hello World</span>
                </pre>
              </div>
              <svg className={styles.uruchom} viewBox="0 0 72 98" focusable="false">
                <path
                  d="M14 10 C 13 34, 13 62, 15 88 C 33 76, 50 63, 64 51 C 47 37, 31 23, 14 10 Z"
                  fill="none"
                  stroke="#4fb39c"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </figure>
          </div>
        </section>

        <section className={`${styles.rzad} ${styles.wybor}`}>
          <h2>{words.homeWhereTitle}</h2>

          {/* Trzecie wystąpienie kreski: rozwidla się, bo Kajet naprawdę ma
              dwie drogi. Krótsza gałąź do katalogu, dłuższa do konta. */}
          <svg
            className={styles.rozwidlenie}
            viewBox="0 0 1120 130"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <g stroke="var(--accent)" strokeWidth="16" strokeLinecap="round" opacity="0.9">
              <path d="M-30 34 C 150 47, 290 53, 428 60" />
              <path d="M428 60 C 378 84, 318 100, 254 109" />
              <path d="M428 60 C 560 70, 682 84, 796 103" />
            </g>
          </svg>

          <div className={styles.kolumny}>
            <div>
              <h3>{words.homeNoAccountTitle}</h3>
              <p>{words.homeNoAccountBody}</p>
            </div>
            <div className={styles.zKontem}>
              <h3>{words.homeWithAccountTitle}</h3>
              <p>{words.homeWithAccountBody}</p>
            </div>
          </div>
        </section>

        <section className={`${styles.waska} ${styles.udostepnianie}`}>
          <h2>{words.homeShareTitle}</h2>
          <p>{words.homeShareBody}</p>
        </section>

        <section className={`${styles.rzad} ${styles.pobranie}`}>
          <div className={styles.pobranieKolumny}>
            {release ? (
              <div>
                <h2>{words.homeDownloadTitle}</h2>
                <ol className={styles.kroki}>
                  <li>{words.homeStepOne}</li>
                  <li>{words.homeStepTwo}</li>
                  <li>{words.homeStepThree}</li>
                </ol>

                <div className={styles.hakPrzycisk}>
                  <a
                    className={`${styles.przycisk} ${styles.pelny}`}
                    href="/download/file"
                    download
                  >
                    {words.homeDownloadFile}
                  </a>
                  {/* Czwarte, ostatnie wystąpienie kreski: haczyk wskazuje
                      jedyne działanie, które gość ma tu wykonać. */}
                  <svg
                    className={styles.hak}
                    viewBox="0 0 120 96"
                    fill="none"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M116 8 C 76 10, 42 24, 34 50 C 28 70, 44 84, 66 80 C 80 77, 86 66, 78 58"
                      stroke="var(--accent)"
                      strokeWidth="13"
                      strokeLinecap="round"
                      opacity="0.9"
                    />
                  </svg>
                </div>

                <p className={styles.drobne}>
                  {words.homeDownloadFacts}{" "}
                  <Link className={styles.zwyklyOdnosnik} href="/download">
                    {words.homeDownloadPage}
                  </Link>
                </p>
              </div>
            ) : null}

            <div className={styles.pobraniePrawa}>
              <h3>{words.homeInviteTitle}</h3>
              <p>{words.homeInviteBody}</p>
              {signedIn ? null : (
                <Link className={styles.przycisk} href="/register">
                  {words.haveInviteCode}
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
