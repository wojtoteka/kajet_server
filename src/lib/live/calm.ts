/*
  Napis łącza przy notatce - spokojniejszy niż prawdziwy stan strumienia.

  Strumień zmian zrywa się i wraca sam (pośrednik, uśpiona karta, zmiana
  sieci), a po drodze przechodzi przez „offline" i „connecting". Napis
  pokazywał każdy krok, więc „Offline" mignęło i znikało, a obok stało raz
  „Łączę…", raz „Połączono". Teraz jest jeden z dwóch: „Połączono" albo
  „Offline", a zerwanie krótsze niż DROP_GRACE_MS go nie rusza. Ten sam
  rachunek liczy aplikacja (LiveLabel.kt, LiveCalm) - strona i tablet
  mówią w tej samej chwili to samo.
*/

import type { LiveStatus } from "@/components/useLiveNote";

export type LiveShown = "none" | "connected" | "offline";

/** Tyle może trwać zerwane łącze, zanim „Połączono" zmieni się w „Offline". */
export const DROP_GRACE_MS = 6_000;

/** Tyle czeka pierwsze łączenie po otwarciu notatki, zanim napis powie „Offline". */
export const CONNECT_GRACE_MS = 4_000;

/**
 * Co pokazać, gdy dotąd widać `shown`, strumień jest w stanie `status`,
 * a na żywo nie jest od `notLiveMs` milisekund. Czas liczy się od zerwania,
 * nie od każdej kolejnej próby łączenia - inaczej „Offline" nie pokazałoby
 * się nigdy.
 */
export function calmLiveShown(shown: LiveShown, status: LiveStatus, notLiveMs: number): LiveShown {
  if (status === "live") return "connected";
  if (status === "off") return "none";
  if (shown === "offline") return "offline";
  if (shown === "connected") return notLiveMs >= DROP_GRACE_MS ? "offline" : "connected";
  // Pierwsze łączenie: bez sieci od razu „Offline", w trakcie - chwila ciszy.
  if (status === "offline") return "offline";
  return notLiveMs >= CONNECT_GRACE_MS ? "offline" : "none";
}

/** Za ile sprawdzić jeszcze raz, bo napis może się zmienić; null - nie zmieni się sam. */
export function calmRecheckIn(shown: LiveShown, status: LiveStatus, notLiveMs: number): number | null {
  if (status === "live" || status === "off") return null;
  if (shown === "connected") return Math.max(0, DROP_GRACE_MS - notLiveMs);
  if (shown === "none") return Math.max(0, CONNECT_GRACE_MS - notLiveMs);
  return null;
}
