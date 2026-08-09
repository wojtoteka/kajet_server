/*
  Zapora na sprawdzaniu tokenów hCaptchy.

  Akcja checkCaptcha (app/contact/actions.ts) jest publiczna jak cała strona
  kontaktu, a każde jej wywołanie kosztuje nas jedno zapytanie do
  api.hcaptcha.com. Bez granic ktoś złośliwy mógłby przez nasz serwer zalewać
  hCaptchę śmieciem, aż ta obrazi się na jego adres - i captcha przestałaby
  działać wszystkim. Granice są dwie: długość tokenu (prawdziwe mają kilka
  kilobajtów) i liczba sprawdzeń z jednego adresu.

  Licznik siedzi w pamięci procesu - tak samo jak zapora logowania
  (signin-limits.ts) i zapora raportów o awariach (crash-limits.ts).
*/

/** Ile sprawdzeń z jednego adresu mieści się w oknie. Człowiekowi starcza
    kilka; API Wojtoteki i tak nie przyjmie więcej niż 30 wiadomości. */
export const MAX_PER_WINDOW = 30;

export const WINDOW_MS = 15 * 60 * 1000;

/** Najdłuższy przyjmowany token. Prawdziwe mają kilka kilobajtów - co
    dłuższe, to nie token, tylko śmieć, którego nie ma co wozić do hCaptchy. */
export const LONGEST_TOKEN = 10_000;

type Window = { start: number; count: number };

const seen = new Map<string, Window>();

const CLEANUP_EVERY = 200;
let sinceCleanup = 0;

/**
 * Czy wolno sprawdzić token z tego adresu. Od razu dolicza próbę, bo liczy
 * się każde sprawdzenie, nie tylko nieudane.
 *
 * Zapytanie bez rozpoznanego adresu (brak nagłówków od pośrednika) idzie na
 * wspólny licznik: lepiej wspólny niż żaden.
 */
export function captchaCheckAllowed(from: string | null): boolean {
  const now = Date.now();
  cleanupSometimes(now);

  const key = from ?? "bez-adresu";
  const window = seen.get(key);

  if (!window || now - window.start >= WINDOW_MS) {
    seen.set(key, { start: now, count: 1 });
    return true;
  }

  if (window.count >= MAX_PER_WINDOW) return false;

  window.count += 1;
  return true;
}

function cleanupSometimes(now: number): void {
  sinceCleanup += 1;
  if (sinceCleanup < CLEANUP_EVERY) return;
  sinceCleanup = 0;

  for (const [key, window] of seen) {
    if (now - window.start >= WINDOW_MS) seen.delete(key);
  }
}

/** Do testów: czyści całą pamięć licznika. */
export function forgetAllCaptchaChecks(): void {
  seen.clear();
  sinceCleanup = 0;
}
