/*
  Zapora na punkcie mówiącym o najnowszym wydaniu aplikacji.

  `GET /api/v1/app/latest` nie wymaga tokenu - sprawdzić aktualizację trzeba móc
  także przed zalogowaniem, a plik i tak leży na stronie do wzięcia przez
  każdego. Cena jest taka sama jak przy raportach o awariach: zapytać może
  każdy, kto zna adres.

  Granica jest tu jednak dużo luźniejsza niż przy awariach, bo odpowiedź
  kosztuje odczyt jednego wiersza i idzie z pięciominutowym cache. Aplikacja
  pyta raz na uruchomienie, a człowiek najwyżej kilka razy z ustawień - sto
  zapytań na godzinę zostawia zapas nawet dla całego domu za jednym adresem
  i zatrzymuje dopiero kogoś, kto łomocze w punkt w kółko.

  Licznik siedzi w pamięci procesu, tak jak zapora logowania (signin-limits.ts),
  limit uruchomień kodu (run-limits.ts) i zapora awarii (crash-limits.ts).
*/

/** Ile zapytań z jednego adresu mieści się w oknie. */
export const MAX_PER_WINDOW = 100;

export const WINDOW_MS = 60 * 60 * 1000;

type Window = { start: number; count: number };

const seen = new Map<string, Window>();

const CLEANUP_EVERY = 200;
let sinceCleanup = 0;

export type VersionGate = { allowed: true } | { allowed: false; retryInSeconds: number };

/**
 * Czy wolno teraz odpowiedzieć temu adresowi. Od razu dolicza zapytanie.
 *
 * Zapytanie bez rozpoznanego adresu (brak nagłówków od pośrednika) idzie na
 * wspólny licznik: lepiej wspólny niż żaden.
 */
export function versionCheckAllowed(from: string | null): VersionGate {
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
export function forgetAllVersionChecks(): void {
  seen.clear();
  sinceCleanup = 0;
}
