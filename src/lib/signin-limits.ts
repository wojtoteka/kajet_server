import { DEFAULT_LANGUAGE, tooManySignInsIn, words as dictionary, type Words } from "./i18n";
import { bucket, forgetAttempts, noteAttempts, readAttempts } from "./rate-limit";
/*
  Zapora przed zgadywaniem hasła.

  Pięć nieudanych prób pod rząd zamykają logowanie na kwadrans. Liczy się
  osobno adres e-mail i osobno komputer/telefon, z którego przyszło zapytanie:
  ktoś, kto wali w jedno konto z wielu miejsc, i ktoś, kto z jednego miejsca
  próbuje wielu kont, zatrzymują się tak samo. Udane logowanie kasuje licznik,
  więc pomyłka we własnym haśle nie ma żadnych skutków.

  Licznik siedzi w bazie (rate-limit.ts), a nie w pamięci procesu - przerwa ma
  przeżyć restart serwera, inaczej kwadrans kończyłby się przy najbliższym
  wdrożeniu.
*/

export const MAX_ATTEMPTS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

export type SignInGate =
  | { allowed: true }
  | { allowed: false; retryInSeconds: number; message: string };

/** Klucze, na których stoi licznik dla jednej próby logowania. */
function keysFor(email: string, from: string | null): string[] {
  const keys = [bucket("logowanie:mail", email.trim().toLowerCase())];
  if (from) keys.push(bucket("logowanie:skad", from));
  return keys;
}

/**
 * Adres, z którego przyszło zapytanie.
 *
 * Topologia (z `nginx -T` na produkcji, 2026-08-08): użytkownik → Cloudflare
 * → nginx → Node. nginx ustawia `X-Real-IP: $remote_addr` (adres POŁĄCZENIA,
 * niepodrabialny) i DOKLEJA $remote_addr NA KOŃCU `X-Forwarded-For`
 * (proxy_add_x_forwarded_for nie kasuje tego, co przysłał klient). Pierwszego
 * elementu XFF nie wolno czytać NIGDY: wpisuje go klient i może go podmieniać
 * przy każdym żądaniu, a wtedy limity per adres przestają istnieć.
 *
 * Modułu real_ip w nginxie nie ma, więc przy ruchu przez Cloudflare
 * $remote_addr to adres krawędzi CF, nie użytkownika - prawdziwy adres niesie
 * wtedy `cf-connecting-ip`, wpisywany przez Cloudflare. Stąd kolejność:
 * cf-connecting-ip → x-real-ip → OSTATNI element XFF → null. Gdyby origin
 * dało się kiedyś osiągnąć z pominięciem Cloudflare, cf-connecting-ip mógłby
 * wpisać sam napastnik - wtedy trzeba by go przyjmować tylko z adresów CF.
 *
 * Gołe nagłówki zamiast Request przychodzą z akcji serwerowych - tam Request
 * nie istnieje, jest tylko `headers()` z next/headers.
 */
export function callerAddress(source: Request | Headers): string | null {
  const headers = source instanceof Request ? source.headers : source;

  const cloudflare = headers.get("cf-connecting-ip")?.trim();
  if (cloudflare) return cloudflare;

  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",");
    const last = parts[parts.length - 1]?.trim();
    if (last) return last;
  }

  return null;
}

/** Czy wolno teraz próbować. Nic nie zapisuje - samo pytanie. */
export async function signInAllowed(
  email: string,
  from: string | null,
  /*
    Zdanie o zaporze widzi człowiek, więc idzie w jego języku. Domyślny
    słownik jest dla testów jednostkowych, które o język nie pytają.
  */
  words: Words = dictionary(DEFAULT_LANGUAGE),
): Promise<SignInGate> {
  const now = Date.now();
  const counters = await readAttempts(keysFor(email, from), WINDOW_MS);

  let longestWait = 0;
  for (const counter of counters) {
    if (counter.hits < MAX_ATTEMPTS) continue;
    longestWait = Math.max(longestWait, counter.startedAt.getTime() + WINDOW_MS - now);
  }

  if (longestWait <= 0) return { allowed: true };

  const retryInSeconds = Math.ceil(longestWait / 1000);
  const minutes = Math.ceil(retryInSeconds / 60);
  return {
    allowed: false,
    retryInSeconds,
    message: tooManySignInsIn(words, minutes),
  };
}

/** Nieudana próba - licznik rośnie. */
export async function noteFailedSignIn(email: string, from: string | null): Promise<void> {
  await noteAttempts(keysFor(email, from), WINDOW_MS);
}

/** Udane logowanie - licznik od zera, żeby własna pomyłka nic nie kosztowała. */
export async function clearFailedSignIns(email: string, from: string | null): Promise<void> {
  await forgetAttempts(keysFor(email, from));
}
