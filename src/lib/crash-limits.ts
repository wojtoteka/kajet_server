import { bucket, passes, type Gate } from "./rate-limit";

/*
  Zapora na punkcie przyjmującym awarie.

  `POST /api/v1/crash` nie wymaga tokenu - awaria trafia się także przed
  zalogowaniem i wtedy najbardziej trzeba o niej wiedzieć. Cena jest taka, że
  wpisać tam coś może każdy, kto zna adres. Stąd trzy granice: ile raportów z
  jednego adresu na godzinę, jak duży może być jeden raport i ile ich w ogóle
  zostaje w bazie.

  Licznik siedzi w bazie (rate-limit.ts) razem z licznikami wszystkich
  pozostałych zapór.
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

export type CrashGate = Gate;

/**
 * Czy wolno przyjąć raport z tego adresu. Od razu dolicza próbę, bo tu - w
 * odróżnieniu od logowania - liczy się każdy raport, nie tylko nieudany.
 *
 * Zapytanie bez rozpoznanego adresu (brak nagłówków od pośrednika) idzie na
 * wspólny licznik: lepiej wspólny niż żaden.
 */
export async function crashAllowed(from: string | null): Promise<CrashGate> {
  return passes(bucket("awarie", from ?? "bez-adresu"), MAX_PER_WINDOW, WINDOW_MS);
}
