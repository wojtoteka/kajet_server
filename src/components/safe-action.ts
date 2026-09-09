"use client";

/*
  Akcja serwerowa, która nie zabiera ze sobą całej strony.

  Kiedy strona otwarta w przeglądarce jest starsza niż to, co stoi na serwerze -
  a tak ma każdy, kto miał otwartą kartę w czasie wdrożenia - serwer nie zna
  identyfikatora akcji z tej karty i odpowiada 404 („Server action not found”,
  w logu pm2 jako „Failed to find Server Action” albo „The Server Reference ID
  did not match the expected format”). W przeglądarce kończy się to odrzuconą
  obietnicą, którą `useActionState` rzuca w renderze - a wtedy React zwija całe
  drzewo do najbliższej granicy błędu. Razem z drzewem znika edytor i wszystko,
  czego serwer jeszcze nie widział. Tą samą drogą idzie zerwane łącze i telefon,
  który uśpił kartę w pół zapytania.

  Tutaj taki błąd zamienia się w zwykłą odpowiedź akcji - tę samą, w której
  wracają błędy z serwera. Notatka zostaje na ekranie, a przy przycisku zapisu
  widać, że zapis nie doszedł. Autozapis spróbuje jeszcze raz przy następnej
  zmianie w treści - chyba że strona jest starsza niż serwer, bo wtedy nie ma
  czego próbować (patrz `outdated` niżej).

  Czego NIE łapiemy: przekierowań i „nie ma takiej strony”. Next prowadzi je
  przez wyjątek z polem `digest` zaczynającym się od „NEXT_” - to jego sposób na
  nawigację, nie awaria. Połknięcie takiego wyjątku zatrzymałoby na przykład
  przejście na stronę świeżo założonej notatki.
*/

/** Wyjątek, którym Next.js przenosi gdzie indziej. Nie jest awarią. */
function routing(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

/*
  Zerwane łącze wygląda tu tak samo jak strona starsza niż serwer, a to dwie
  różne rzeczy: pierwsze mija samo, drugie nie minie nigdy. Identyfikatory akcji
  siedzą w kawałku strony wczytanym przy jej otwarciu i nic ich nie odświeży
  poza przeładowaniem - kolejne próby z tej samej strony trafią w to samo 404.

  Next odpowiada wtedy nagłówkiem `x-nextjs-action-not-found`, a przeglądarkowa
  część routera zamienia go na wyjątek o nazwie `UnrecognizedActionError`.
  Rozpoznajemy go po tej nazwie, a nie przez `unstable_isUnrecognizedActionError`
  z `next/navigation`: import ciągnie za sobą cały router przeglądarki, a testy
  chodzą w środowisku „node”. Nazwa jest zwykłym napisem i przeżywa minifikację,
  a gdyby Next kiedyś ją zmienił, taki błąd wróci po prostu jako „nie doszło” -
  czyli tak, jak było przedtem.
*/
function outdated(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  return (error as { name?: unknown }).name === "UnrecognizedActionError";
}

/*
  Raz stara, zawsze stara - do przeładowania. Po pierwszym takim błędzie kolejne
  wywołania nie ruszają już na serwer. Bez tego autozapis pukałby do niego przy
  każdej zmianie w notatce, dostawał to samo 404, a w logu pm2 rosłaby ściana
  „Failed to find Server Action” - po jednym wierszu na każde naciśnięcie
  klawisza z pauzą.
*/
let outdatedPage = false;

/**
 * Owija akcję podawaną do `useActionState`. `whenLost` to odpowiedź, którą
 * dostanie strona, gdy wywołanie w ogóle nie doszło do serwera; `whenOutdated`
 * to odpowiedź na „ta strona jest starsza niż serwer”, gdzie samo powtórzenie
 * już nic nie da i trzeba odświeżyć. Bez drugiego napisu idzie ten pierwszy.
 *
 * Owijka powstaje przy każdym renderze i tak ma być: `useActionState` sięga po
 * akcję na nowo za każdym razem, więc nic tu nie musi być stałe.
 */
export function safeAction<S>(
  action: (previous: S, data: FormData) => Promise<S>,
  whenLost: S,
  whenOutdated: S = whenLost,
): (previous: S, data: FormData) => Promise<S> {
  return async (previous, data) => {
    if (outdatedPage) return whenOutdated;
    try {
      return await action(previous, data);
    } catch (error) {
      if (routing(error)) throw error;
      // Do konsoli przeglądarki, żeby przy zgłoszeniu było co obejrzeć.
      console.error(error);
      if (outdated(error)) {
        outdatedPage = true;
        return whenOutdated;
      }
      return whenLost;
    }
  };
}
