/*
  Zapora na punkcie przyjmującym awarie.

  `POST /api/v1/crash` nie wymaga tokenu — awaria trafia się także przed
  zalogowaniem i wtedy najbardziej trzeba o niej wiedzieć. Cena jest taka, że
  wpisać tam coś może każdy, kto zna adres. Stąd trzy granice: ile raportów z
  jednego adresu na godzinę, jak duży może być jeden raport i ile ich w ogóle
  zostaje w bazie.

  Licznik siedzi w pamięci procesu — tak samo jak zapora logowania
  (signin-limits.ts) i limit uruchomień kodu (run-limits.ts). Kajet chodzi
  jako jeden serwer, a restart co najwyżej wyzeruje licznik komuś, kto i tak
  musiałby zacząć od nowa.
*/

/** Ile raportów z jednego adresu mieści się w oknie. */
export const MAX_PER_WINDOW = 20;

export const WINDOW_MS = 60 * 60 * 1000;

/**
 * Najdłuższy przyjmowany raport.
 *
 * Aplikacja obcina opis do 100 000 znaków przed włożeniem go do intentu
 * (CrashLog.LONGEST_EXTRA), a ślad wywołań rzadko przekracza kilka kilobajtów.
 * 64 KB to szeroki zapas i zarazem granica, powyżej której to już nie jest
 * raport o awarii.
 */
export const LONGEST_REPORT = 64 * 1024;

/** Tyle najnowszych raportów zostaje w bazie. */
export const KEEP_NEWEST = 500;

/** Nic starszego niż tyle dni nie zostaje, nawet jeśli mieści się w liczbie. */
export const KEEP_DAYS = 90;

type Window = { start: number; count: number };

const seen = new Map<string, Window>();

const CLEANUP_EVERY = 200;
let sinceCleanup = 0;

export type CrashGate = { allowed: true } | { allowed: false; retryInSeconds: number };

/**
 * Czy wolno przyjąć raport z tego adresu. Od razu dolicza próbę, bo tu — w
 * odróżnieniu od logowania — liczy się każdy raport, nie tylko nieudany.
 *
 * Zapytanie bez rozpoznanego adresu (brak nagłówków od pośrednika) idzie na
 * wspólny licznik: lepiej wspólny niż żaden.
 */
export function crashAllowed(from: string | null): CrashGate {
  const now = Date.now();
  cleanupSometimes(now);

  const key = from ?? "bez-adresu";
  const window = seen.get(key);

  if (!window || now - window.start >= WINDOW_MS) {
    seen.set(key, { start: now, count: 1 });
    return { allowed: true };
  }

  if (window.count >= MAX_PER_WINDOW) {
    return {
      allowed: false,
      retryInSeconds: Math.ceil((WINDOW_MS - (now - window.start)) / 1000),
    };
  }

  window.count += 1;
  return { allowed: true };
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
export function forgetAllCrashes(): void {
  seen.clear();
  sinceCleanup = 0;
}
