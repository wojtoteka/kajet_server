import { bucket, passes } from "./rate-limit";

/*
  Zapora na sprawdzaniu tokenów hCaptchy.

  Akcja checkCaptcha (app/contact/actions.ts) jest publiczna jak cała strona
  kontaktu, a każde jej wywołanie kosztuje nas jedno zapytanie do
  api.hcaptcha.com. Bez granic ktoś złośliwy mógłby przez nasz serwer zalewać
  hCaptchę śmieciem, aż ta obrazi się na jego adres - i captcha przestałaby
  działać wszystkim. Granice są dwie: długość tokenu (prawdziwe mają kilka
  kilobajtów) i liczba sprawdzeń z jednego adresu.

  Licznik siedzi w bazie (rate-limit.ts) razem z licznikami wszystkich
  pozostałych zapór.
*/

/** Ile sprawdzeń z jednego adresu mieści się w oknie. Człowiekowi starcza
    kilka; API Wojtoteki i tak nie przyjmie więcej niż 30 wiadomości. */
export const MAX_PER_WINDOW = 30;

export const WINDOW_MS = 15 * 60 * 1000;

/** Najdłuższy przyjmowany token. Prawdziwe mają kilka kilobajtów - co
    dłuższe, to nie token, tylko śmieć, którego nie ma co wozić do hCaptchy. */
export const LONGEST_TOKEN = 10_000;

/**
 * Czy wolno sprawdzić token z tego adresu. Od razu dolicza próbę, bo liczy
 * się każde sprawdzenie, nie tylko nieudane.
 *
 * Zapytanie bez rozpoznanego adresu (brak nagłówków od pośrednika) idzie na
 * wspólny licznik: lepiej wspólny niż żaden.
 */
export async function captchaCheckAllowed(from: string | null): Promise<boolean> {
  const gate = await passes(bucket("captcha", from ?? "bez-adresu"), MAX_PER_WINDOW, WINDOW_MS);
  return gate.allowed;
}
