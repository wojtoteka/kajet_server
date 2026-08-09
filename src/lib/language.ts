import { cookies, headers } from "next/headers";
import { DEFAULT_LANGUAGE, knownLanguage, words, type Language, type Words } from "./i18n";

export { LANGUAGE_COOKIE, LANGUAGE_CHOICES, LANGUAGE_MAX_AGE } from "./i18n";
export type { Language, Words };

/*
  Język dla komponentów serwerowych.

  Osobny plik od i18n.ts, bo `next/headers` wolno wołać wyłącznie na serwerze -
  gdyby siedziało to razem ze słownikiem, każdy komponent kliencki wciągnąłby je
  za sobą i budowa by stanęła.
*/

export async function currentLanguage(): Promise<Language> {
  const jar = await cookies();
  return knownLanguage(jar.get("kajet-jezyk")?.value);
}

/** Napisy dla tej strony. Do wołania na górze komponentu serwerowego. */
export async function currentWords(): Promise<Words> {
  return words(await currentLanguage());
}

/*
  Napisy dla odpowiedzi API.

  Zdania z API czyta aplikacja i pokazuje je wprost na ekranie, więc muszą być
  w JEJ języku, nie w języku przeglądarki. Ciasteczka tu nie ma - do żądań
  z aplikacji nikt go nie dokłada - więc język przyjeżdża nagłówkiem
  `Accept-Language`, tak jak każe zwyczaj HTTP. Bez nagłówka zostaje polski.

  `headers()` istnieje tylko wewnątrz obsługi żądania. Te same funkcje wołają
  jednak testy jednostkowe, gdzie żadnego żądania nie ma - i tam zamiast
  wywrócić się na komunikacie o błędzie po prostu bierzemy język domyślny.
*/
export async function apiWords(): Promise<Words> {
  let header = "";
  try {
    header = (await headers()).get("accept-language") ?? "";
  } catch {
    return words(DEFAULT_LANGUAGE);
  }
  const first = header.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return words(knownLanguage(first));
}
