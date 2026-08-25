import { bucket, passes, type Gate } from "./rate-limit";

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

  Licznik siedzi w bazie (rate-limit.ts) razem z licznikami wszystkich
  pozostałych zapór.
*/

/** Ile zapytań z jednego adresu mieści się w oknie. */
export const MAX_PER_WINDOW = 100;

export const WINDOW_MS = 60 * 60 * 1000;

export type VersionGate = Gate;

/**
 * Czy wolno teraz odpowiedzieć temu adresowi. Od razu dolicza zapytanie.
 *
 * Zapytanie bez rozpoznanego adresu (brak nagłówków od pośrednika) idzie na
 * wspólny licznik: lepiej wspólny niż żaden.
 */
export async function versionCheckAllowed(from: string | null): Promise<VersionGate> {
  return passes(bucket("wersja", from ?? "bez-adresu"), MAX_PER_WINDOW, WINDOW_MS);
}
