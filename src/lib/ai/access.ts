/*
  Jedno miejsce odpowiadające na pytanie „czy temu kontu wolno prosić asystenta
  o zmianę notatki".

  Wszystko, co dotyka asystenta - punkty API, panel WWW i to, co serwer mówi
  aplikacji o koncie - pyta stąd. Rozsypanie tego po trzech plikach kończy się
  tak, że przycisk znika, a punkt końcowy dalej działa.

  Bramka ma trzy odpowiedzi, nie dwie:

   - wolno,
   - NIE MA takiej funkcji - serwer bez klucza albo konto bez uprawnienia.
     Odpowiedź jest wtedy co do znaku taka sama jak dla nieistniejącej trasy,
     bo odmowa nie ma prawa zdradzić, że asystent w ogóle istnieje,
   - jest, ale brakuje zgody na wysyłanie treści do Google. Tu już nie ma co
     ukrywać: uprawnienie jest nadane, więc człowiek o funkcji wie, a musi się
     dowiedzieć, czego brakuje.
*/

import { error } from "@/lib/api";
import { apiWords } from "@/lib/language";
import { aiWorks } from "@/lib/settings";

/** Tyle o koncie wystarczy, żeby rozstrzygnąć. Cały User nie jest potrzebny. */
export type AiAccount = {
  canUseAi: boolean;
  aiConsentAt: Date | null;
};

export type AiGate =
  | { ok: true }
  /** Udawaj, że takiej trasy nie ma. */
  | { ok: false; hidden: true }
  | { ok: false; hidden: false; code: string; status: number };

/**
 * Czy w interfejsie wolno choćby wspomnieć o asystencie. Brak zgody NIE chowa
 * funkcji - przeciwnie, o zgodę trzeba gdzieś poprosić.
 */
export function aiVisibleFor(account: AiAccount): boolean {
  return aiWorks() && account.canUseAi;
}

/** Czy konto jest gotowe: ma uprawnienie i potwierdziło zgodę. */
export function aiReadyFor(account: AiAccount): boolean {
  return aiVisibleFor(account) && account.aiConsentAt != null;
}

export function aiGate(account: AiAccount): AiGate {
  if (!aiVisibleFor(account)) return { ok: false, hidden: true };
  if (account.aiConsentAt == null) {
    return { ok: false, hidden: false, code: "ai-no-consent", status: 403 };
  }
  return { ok: true };
}

/**
 * Odpowiedź na zamkniętą bramkę.
 *
 * Ukryta odmowa jest przepisana z app/api/[...sciezka]/route.ts - ten sam kod
 * błędu, to samo zdanie, ten sam status. Gdyby tamten plik kiedyś zmienił
 * brzmienie, trzeba zmienić i to; różnica między jedną odmową a drugą jest
 * dokładnie tym, co tu ma nie wyjść na jaw.
 */
export async function aiRefusal(
  gate: Extract<AiGate, { ok: false }>,
): Promise<Response> {
  const words = await apiWords();
  if (gate.hidden) return error("no-route", words.apiUnknownAddress, 404);
  return error(gate.code, words.apiAiNoConsent, gate.status);
}
